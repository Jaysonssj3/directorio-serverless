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
