output "api_url" {
  description = "url sin /api."
  value       = aws_apigatewayv2_stage.default.invoke_url
}
output "lambda_name" {
  value = aws_lambda_function.api.function_name
}
output "lambda_log_group" {
  value = aws_cloudwatch_log_group.lambda.name
}
output "gateway_log_group" {
  value = aws_cloudwatch_log_group.gateway.name
}

output "notifications_topic_arn" { value = aws_sns_topic.notifications.arn }
output "notifications_queue_url" { value = aws_sqs_queue.notifications.url }
output "notifications_dlq_url" { value = aws_sqs_queue.notification_dlq.url }
output "notification_lambda_name" { value = aws_lambda_function.notifications.function_name }
output "notification_logs" { value = aws_cloudwatch_log_group.notifications.name }
output "notification_sender" { value = aws_ses_email_identity.sender.email }
