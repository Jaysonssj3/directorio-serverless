import unittest
from aws_metrics import empty, specs
from report import row, chart

class ResultsTest(unittest.TestCase):
    def test_missing_latency_is_not_zero(self):
        result = row({'data':{'metrics':{},'state':{}}},
                     {'start_utc':'test','vus':10,'stress':False,'planned_seconds':60})
        self.assertIsNone(result['avg_ms'])
        self.assertIsNone(result['rps'])

    def test_accepted_and_attempted_throughput_are_different(self):
        metrics = {key:{'values':values} for key,values in {
            'notification_requests':{'count':100},'notification_accepted':{'count':25},
            'notification_errors':{'rate':.75},'notification_latency':{'avg':42,'p(95)':120}}.items()}
        result = row({'data':{'metrics':metrics,'state':{'testRunDurationMs':10000}}},
                     {'vus':50,'stress':True,'planned_seconds':120})
        self.assertEqual(result['rps'],10)
        self.assertEqual(result['accepted_rps'],2.5)
        self.assertEqual(result['error_pct'],75)
        self.assertIn('<svg', chart([result]))

    def test_dlq_or_inflight_prevents_recovery(self):
        self.assertTrue(empty({'queue':{'visible':0,'inflight':0},'dlq':{'visible':0}}))
        self.assertFalse(empty({'queue':{'visible':0,'inflight':1},'dlq':{'visible':0}}))
        self.assertFalse(empty({'queue':{'visible':0,'inflight':0},'dlq':{'visible':1}}))

    def test_http_api_metrics_use_correct_case(self):
        config=dict(api_id='api',main_lambda='main',notification_lambda='worker',topic='topic',queue='q',dlq='dlq')
        names=[r[3] for r in specs(config) if r[0]=='AWS/ApiGateway']
        self.assertIn('4xx',names)
        self.assertIn('5xx',names)
        self.assertNotIn('4XXError',names)

if __name__ == '__main__':
    unittest.main()
