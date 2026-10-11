import json
import os
import unittest
import uuid
from unittest.mock import Mock, patch
import handler

class NotificationTests(unittest.TestCase):
    def record(self, identifier="sqs-1", **changes):
        data=dict(notificationId=str(uuid.uuid4()),email="recipient@example.com",subject="Prueba",message="Hola")
        data.update(changes)
        return {"messageId": identifier,"body":json.dumps(data)}
    def test_sends_utf8_email_and_acknowledges(self):
        client=Mock();client.send_email.return_value={"MessageId":"ses-1"}
        with patch.dict(os.environ,SENDER_EMAIL="sender@example.com"),patch.object(handler,"ses_client",return_value=client):
            self.assertEqual(handler.handler({"Records":[self.record()]},None),{"batchItemFailures":[]})
        self.assertEqual(client.send_email.call_args.kwargs["Destination"],{"ToAddresses":["recipient@example.com"]})
    def test_failed_message_only_is_retried(self):
        client=Mock();client.send_email.side_effect=[{"MessageId":"ok"},RuntimeError("SES unavailable")]
        with patch.dict(os.environ,SENDER_EMAIL="sender@example.com"),patch.object(handler,"ses_client",return_value=client):
            result=handler.handler({"Records":[self.record("ok"),self.record("retry")]},None)
        self.assertEqual(result,{"batchItemFailures":[{"itemIdentifier":"retry"}]})
    def test_invalid_body_never_sends(self):
        client=Mock()
        with patch.object(handler,"ses_client",return_value=client):
            result=handler.handler({"Records":[self.record(subject="Header\nInjection")]},None)
        client.send_email.assert_not_called()
        self.assertEqual(len(result["batchItemFailures"]),1)
    def test_malformed_json_is_retried(self):
        with patch.object(handler,"ses_client",return_value=Mock()):
            self.assertEqual(handler.handler({"Records":[{"messageId":"bad","body":"{"}]},None),{"batchItemFailures":[{"itemIdentifier":"bad"}]})
if __name__ == "__main__": unittest.main()
