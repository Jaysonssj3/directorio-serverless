"""Genera una polÃƒÂ­tica para el usuario IAM de CI sin introducir credenciales."""
import argparse
import json
import re

p = argparse.ArgumentParser()
p.add_argument('--account', required=True)
p.add_argument('--region', required=True)
p.add_argument('--bucket', required=True)
a = p.parse_args()
if not re.fullmatch(r'\d{12}', a.account) or not re.fullmatch(r'[a-z]{2}-[a-z]+-\d', a.region) or not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', a.bucket):
    raise SystemExit('Cuenta, regiÃƒÂ³n o bucket invÃƒÂ¡lidos')
region = a.region
account = a.account
role = f'arn:aws:iam::{account}:role/directorio-lambda'
statements = [
    {'Effect': 'Allow', 'Action': ['lambda:*'], 'Resource': f'arn:aws:lambda:{region}:{account}:function:directorio-api'},
    {'Effect': 'Allow', 'Action': ['iam:CreateRole','iam:DeleteRole','iam:GetRole','iam:UpdateAssumeRolePolicy','iam:ListRolePolicies','iam:GetRolePolicy','iam:PutRolePolicy','iam:DeleteRolePolicy','iam:ListAttachedRolePolicies','iam:TagRole','iam:UntagRole','iam:ListInstanceProfilesForRole'], 'Resource': role},
    {'Effect': 'Allow', 'Action': 'iam:PassRole', 'Resource': role, 'Condition': {'StringEquals': {'iam:PassedToService': 'lambda.amazonaws.com'}}},
    {'Effect': 'Allow', 'Action': ['apigateway:GET','apigateway:POST','apigateway:PUT','apigateway:PATCH','apigateway:DELETE','apigateway:TagResource'], 'Resource': [f'arn:aws:apigateway:{region}::/apis',f'arn:aws:apigateway:{region}::/apis/*',f'arn:aws:apigateway:{region}::/tags/*']},
    {'Effect': 'Allow', 'Action': ['logs:DescribeLogGroups','logs:CreateLogDelivery','logs:PutResourcePolicy','logs:UpdateLogDelivery','logs:DeleteLogDelivery','logs:DescribeResourcePolicies','logs:GetLogDelivery','logs:ListLogDeliveries'], 'Resource': '*'},
    {'Effect': 'Allow', 'Action': ['logs:CreateLogGroup','logs:DeleteLogGroup','logs:PutRetentionPolicy','logs:DeleteRetentionPolicy','logs:ListTagsForResource','logs:TagResource','logs:UntagResource','logs:ListTagsLogGroup','logs:TagLogGroup','logs:UntagLogGroup'], 'Resource': [f'arn:aws:logs:{region}:{account}:log-group:/aws/lambda/directorio-api*',f'arn:aws:logs:{region}:{account}:log-group:/aws/apigateway/directorio*']},
    {'Effect': 'Allow', 'Action': ['s3:ListBucket','s3:GetBucketLocation'], 'Resource': f'arn:aws:s3:::{a.bucket}'},
    {'Effect': 'Allow', 'Action': ['s3:GetObject','s3:PutObject'], 'Resource': f'arn:aws:s3:::{a.bucket}/directorio/*'},
    {'Effect': 'Allow', 'Action': 's3:DeleteObject', 'Resource': f'arn:aws:s3:::{a.bucket}/directorio/app.tfstate.tflock'},
]
# Deployment permissions for the additional messaging infrastructure.
notification_role = f'arn:aws:iam::{account}:role/notification-lambda-role'
statements[0]['Resource'] = [statements[0]['Resource'], f'arn:aws:lambda:{region}:{account}:function:notification-lambda']
statements[1]['Resource'] = [role, notification_role]
statements[2]['Resource'] = [role, notification_role]
statements[5]['Resource'].append(f'arn:aws:logs:{region}:{account}:log-group:/aws/lambda/notification-lambda*')
statements += [
 {'Effect':'Allow','Action':['sns:CreateTopic','sns:DeleteTopic','sns:GetTopicAttributes','sns:SetTopicAttributes','sns:ListTagsForResource','sns:TagResource','sns:UntagResource','sns:Subscribe','sns:ListSubscriptionsByTopic'], 'Resource':f'arn:aws:sns:{region}:{account}:directorio-notifications'},
 {'Effect':'Allow','Action':['sns:GetSubscriptionAttributes','sns:SetSubscriptionAttributes','sns:Unsubscribe'], 'Resource':f'arn:aws:sns:{region}:{account}:directorio-notifications'},
 {'Effect':'Allow','Action':['sqs:CreateQueue','sqs:DeleteQueue','sqs:GetQueueUrl','sqs:GetQueueAttributes','sqs:SetQueueAttributes','sqs:ListQueueTags','sqs:TagQueue','sqs:UntagQueue'], 'Resource':f'arn:aws:sqs:{region}:{account}:directorio-notifications*'},
 {'Effect':'Allow','Action':['lambda:CreateEventSourceMapping','lambda:GetEventSourceMapping','lambda:UpdateEventSourceMapping','lambda:DeleteEventSourceMapping','lambda:ListEventSourceMappings','lambda:TagResource','lambda:UntagResource','lambda:ListTags'], 'Resource':'*', 'Condition':{'StringEquals':{'aws:RequestedRegion':region}}},
 {'Effect':'Allow','Action':['ses:VerifyEmailIdentity','ses:GetIdentityVerificationAttributes','ses:GetIdentityDkimAttributes','ses:DeleteIdentity'], 'Resource':'*', 'Condition':{'StringEquals':{'aws:RequestedRegion':region}}},
]
print(json.dumps({'Version':'2012-10-17','Statement':statements}, indent=2))
