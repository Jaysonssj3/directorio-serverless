"""SQS raw SNS message -> SES. No recipient/body/token values in logs."""
import json
import logging
import os
import re
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)
_client = None

def ses_client():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config
        _client = boto3.client("ses", config=Config(connect_timeout=3, read_timeout=8, retries={"max_attempts": 2}))
    return _client

def process(record, client):
    event = json.loads(record["body"])
    notification_id = str(uuid.UUID(event["notificationId"]))
    email, subject, message = (event[k] for k in ("email", "subject", "message"))
    if not all(isinstance(v, str) and v.strip() for v in (email, subject, message)):
        raise ValueError("Missing fields")
    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("Invalid email")
    if len(subject) > 150 or "\r" in subject or "\n" in subject or len(message) > 5000:
        raise ValueError("Invalid content")
    logger.info(json.dumps({"event": "notification_received", "notificationId": notification_id,
                            "sqsMessageId": record["messageId"]}))
    result = client.send_email(
        Source=os.environ["SENDER_EMAIL"],
        Destination={"ToAddresses": [email]},
        Message={"Subject": {"Data": subject, "Charset": "UTF-8"},
                 "Body": {"Text": {"Data": message, "Charset": "UTF-8"}}},
        Tags=[{"Name": "notificationId", "Value": notification_id}],
    )
    logger.info(json.dumps({"event": "email_accepted_by_ses", "notificationId": notification_id,
                            "sqsMessageId": record["messageId"], "sesMessageId": result["MessageId"]}))

def handler(event, context):
    failures = []
    for record in event.get("Records", []):
        try:
            process(record, ses_client())
        except Exception as error:
            # A failed item remains on SQS; Lambda deletes only successful items.
            logger.error(json.dumps({"event": "notification_failed", "sqsMessageId": record["messageId"],
                                     "errorType": type(error).__name__}))
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
