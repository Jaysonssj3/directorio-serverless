"""Read-only AWS collection. Run in AWS CloudShell, in us-east-2."""
import argparse
import datetime as dt
import json
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parent

def now():
    return dt.datetime.now(dt.timezone.utc)

def iso(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Usa fecha ISO con zona, por ejemplo 2026-10-18T15:00:00Z')
    return parsed

def specs(config):
    rows = []
    def add(namespace, dimension, resource, metrics):
        for name, stat in metrics:
            rows.append((namespace, dimension, resource, name, stat))
    add('AWS/ApiGateway', 'ApiId', config['api_id'],
        [('Count','Sum'),('4xx','Sum'),('5xx','Sum'),('Latency','Average'),
         ('Latency','p95'),('Latency','p99'),('IntegrationLatency','Average')])
    for key in ['main_lambda', 'notification_lambda']:
        add('AWS/Lambda','FunctionName',config[key],
            [('Invocations','Sum'),('Duration','Average'),('Errors','Sum'),
             ('ConcurrentExecutions','Maximum'),('Throttles','Sum')])
    add('AWS/SNS','TopicName',config['topic'],
        [('NumberOfMessagesPublished','Sum'),('NumberOfNotificationsDelivered','Sum'),
         ('NumberOfNotificationsFailed','Sum')])
    for key in ['queue','dlq']:
        add('AWS/SQS','QueueName',config[key],
            [('NumberOfMessagesSent','Sum'),('NumberOfMessagesReceived','Sum'),
             ('NumberOfMessagesDeleted','Sum'),('ApproximateNumberOfMessagesVisible','Maximum'),
             ('ApproximateNumberOfMessagesNotVisible','Maximum'),
             ('ApproximateNumberOfMessagesDelayed','Maximum'),('ApproximateAgeOfOldestMessage','Maximum')])
    return rows

def queue_snapshot(sqs, urls):
    result = {'utc': now().isoformat()}
    for key, url in urls.items():
        attrs = sqs.get_queue_attributes(QueueUrl=url, AttributeNames=[
            'ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible',
            'ApproximateNumberOfMessagesDelayed'])['Attributes']
        result[key] = {k: int(v) for k,v in attrs.items()}
    return result

def empty(snapshot):
    return all(sum(snapshot[key].values()) == 0 for key in ['queue','dlq'])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['preflight','capture','recovery'])
    parser.add_argument('--start')
    parser.add_argument('--end')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    import boto3
    config = json.loads((ROOT / 'config.json').read_text(encoding='utf-8'))
    session = boto3.Session(region_name=config['region'])
    sqs = session.client('sqs')
    urls = {k: sqs.get_queue_url(QueueName=config[k])['QueueUrl'] for k in ['queue','dlq']}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.mode == 'preflight':
        gateway = session.client('apigatewayv2').get_stage(ApiId=config['api_id'], StageName='$default')
        ses = session.client('ses').get_identity_verification_attributes(Identities=['test@test.com'])
        functions = {}
        for key in ['main_lambda','notification_lambda']:
            info = session.client('lambda').get_function_configuration(FunctionName=config[key])
            functions[key] = {field:info.get(field) for field in ['FunctionName','Runtime','MemorySize','Timeout','LastModified','State']}
        result = {'utc':now().isoformat(), 'region':config['region'],
            'gateway_default_settings':gateway.get('DefaultRouteSettings'),
            'gateway_route_settings':gateway.get('RouteSettings',{}), 'functions':functions,
            'recipient':ses.get('VerificationAttributes',{}),
            'ses_quota':session.client('ses').get_send_quota(),
            'queues':queue_snapshot(sqs,urls),
            'mapping':[{k:item.get(k) for k in ['UUID','State','BatchSize','ScalingConfig','FunctionResponseTypes']}
                for item in session.client('lambda').list_event_source_mappings(FunctionName=config['notification_lambda'])['EventSourceMappings']]}
        result['ses_quota'].pop('ResponseMetadata',None)
        (out/'preflight.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
        print(json.dumps(result,indent=2,default=str))
    elif args.mode == 'recovery':
        origin = iso(args.start) if args.start else now()
        started = time.monotonic()
        consecutive = 0
        recovered = False
        with (out/'recovery.jsonl').open('w',encoding='utf-8') as stream:
            while time.monotonic()-started < config['recovery_timeout_seconds']:
                row = queue_snapshot(sqs,urls)
                row['seconds_since_stop'] = (now()-origin).total_seconds()
                consecutive = consecutive+1 if empty(row) else 0
                stream.write(json.dumps(row)+'\n'); stream.flush()
                print(json.dumps(row),flush=True)
                if consecutive >= config['recovery_empty_samples']:
                    recovered = True
                    break
                time.sleep(config['recovery_poll_seconds'])
        (out/'recovery-summary.json').write_text(json.dumps({
            'observed_empty_primary_and_dlq':recovered, 'empty_samples_required':config['recovery_empty_samples'],
            'elapsed_since_stop_seconds':(now()-origin).total_seconds(),
            'note':'Conteos aproximados. Una DLQ no vacía impide declarar recuperación exitosa. Verificar logs y Lambda Duration/ConcurrentExecutions.'},indent=2),encoding='utf-8')
    else:
        if not args.start or not args.end:
            parser.error('capture requiere --start y --end en UTC')
        start,end = iso(args.start),iso(args.end)
        if end <= start:
            parser.error('end debe ser posterior a start')
        rows = specs(config)
        queries = [{'Id':f'm{i}', 'MetricStat':{'Metric':{'Namespace':ns,'MetricName':metric,
            'Dimensions':[{'Name':dim,'Value':resource}]},'Period':60,'Stat':stat},'ReturnData':True}
            for i,(ns,dim,resource,metric,stat) in enumerate(rows)]
        series = {f'm{i}':{'namespace':ns,'resource':resource,'metric':metric,'stat':stat,'points':[],'statuses':[]}
            for i,(ns,dim,resource,metric,stat) in enumerate(rows)}
        for page in session.client('cloudwatch').get_paginator('get_metric_data').paginate(
                MetricDataQueries=queries, StartTime=start, EndTime=end, ScanBy='TimestampAscending'):
            for item in page['MetricDataResults']:
                series[item['Id']]['points'].extend([{'utc':t.isoformat(),'value':v} for t,v in zip(item['Timestamps'],item['Values'])])
                series[item['Id']]['statuses'].append(item.get('StatusCode'))
        (out/'metrics.json').write_text(json.dumps({'start':args.start,'end':args.end,
            'period_seconds':60,'collected_at':now().isoformat(),'series':series},indent=2),encoding='utf-8')
        # Store only notification event messages; no login responses or environment configuration.
        with (out/'events.jsonl').open('w',encoding='utf-8') as stream:
            for key in ['main_lambda','notification_lambda']:
                group = '/aws/lambda/'+config[key]
                for page in session.client('logs').get_paginator('filter_log_events').paginate(
                        logGroupName=group,startTime=int(start.timestamp()*1000),endTime=int(end.timestamp()*1000)):
                    for event in page.get('events',[]):
                        if any(marker in event['message'] for marker in ['notification_published','notification_received','notification_failed','email_accepted_by_ses']):
                            stream.write(json.dumps({'group':group,'timestamp':event['timestamp'],
                                'event_id':event['eventId'],'message':event['message']})+'\n')
        print('Captura guardada. Si faltan puntos, espera unos minutos y repite el mismo intervalo.')

if __name__ == '__main__':
    main()
