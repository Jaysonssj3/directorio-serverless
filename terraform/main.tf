data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}-api"
  retention_in_days = 7
}
resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = 7
}
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "logs" {
  name = "write-own-logs"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
    }]
  })
}
resource "aws_lambda_function" "api" {
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.lambda.arn
  runtime          = "java21"
  architectures    = ["x86_64"]
  handler          = "com.ejemplo.usuarios.adapter.in.lambda.StreamLambdaHandler::handleRequest"
  filename         = var.lambda_zip
  source_code_hash = filebase64sha256(var.lambda_zip)
  memory_size      = 1536
  timeout          = 28
  # Sin VPC: salida TLS directa a Neon; evita un NAT Gateway para esta práctica.
  environment {
    variables = {
      NOTIFICATIONS_TOPIC_ARN  = aws_sns_topic.notifications.arn
      DATABASE_URL             = var.database_url
      JWT_SECRET               = var.jwt_secret
      SPRING_PROFILES_ACTIVE   = "lambda"
      BOOTSTRAP_ADMIN_ENABLED  = tostring(var.admin_email != "" && var.admin_password != "")
      BOOTSTRAP_ADMIN_EMAIL    = var.admin_email
      BOOTSTRAP_ADMIN_PASSWORD = var.admin_password
      JAVA_TOOL_OPTIONS        = "-XX:+TieredCompilation -XX:TieredStopAtLevel=1"
    }
  }
  depends_on = [aws_iam_role_policy.logs, aws_iam_role_policy.publish_notifications]
}
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-http"
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.gateway.arn
    format = jsonencode({
      requestId = "$context.requestId", routeKey = "$context.routeKey",
      status    = "$context.status", responseLength = "$context.responseLength"
    })
  }
}
resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/api/*"
}

# Asynchronous email pipeline. SNS publishes raw JSON into SQS.
resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications"
}
resource "aws_sqs_queue" "notification_dlq" {
  name                      = "${var.project_name}-notifications-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}
resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project_name}-notifications"
  visibility_timeout_seconds = 180
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn, maxReceiveCount = 5 })
}
resource "aws_sqs_queue_policy" "notifications" {
  queue_url = aws_sqs_queue.notifications.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Principal = { Service = "sns.amazonaws.com" }, Action = "sqs:SendMessage",
    Resource  = aws_sqs_queue.notifications.arn,
    Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.notifications.arn }, StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
  }] })
}
resource "aws_sns_topic_subscription" "notifications" {
  topic_arn            = aws_sns_topic.notifications.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.notifications.arn
  raw_message_delivery = true
  depends_on           = [aws_sqs_queue_policy.notifications]
}
resource "aws_iam_role_policy" "publish_notifications" {
  name = "publish-notifications"
  role = aws_iam_role.lambda.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Action = "sns:Publish", Resource = aws_sns_topic.notifications.arn
  }] })
}
resource "aws_ses_email_identity" "sender" {
  email = var.notification_sender_email
}
resource "aws_cloudwatch_log_group" "notifications" {
  name              = "/aws/lambda/notification-lambda"
  retention_in_days = 7
}
resource "aws_iam_role" "notifications" {
  name = "notification-lambda-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole"
  }] })
}
resource "aws_iam_role_policy" "notifications" {
  name = "consume-queue-send-email"
  role = aws_iam_role.notifications.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.notifications.arn}:*" },
    { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], Resource = aws_sqs_queue.notifications.arn },
    { Effect = "Allow", Action = "ses:SendEmail", Resource = aws_ses_email_identity.sender.arn,
    Condition = { StringEquals = { "ses:FromAddress" = var.notification_sender_email } } }
  ] })
}
resource "aws_lambda_function" "notifications" {
  function_name    = "notification-lambda"
  role             = aws_iam_role.notifications.arn
  runtime          = "python3.13"
  handler          = "handler.handler"
  filename         = var.notification_zip
  source_code_hash = filebase64sha256(var.notification_zip)
  timeout          = 30
  memory_size      = 128
  environment { variables = { SENDER_EMAIL = var.notification_sender_email } }
  depends_on = [aws_iam_role_policy.notifications]
}
resource "aws_lambda_event_source_mapping" "notifications" {
  event_source_arn        = aws_sqs_queue.notifications.arn
  function_name           = aws_lambda_function.notifications.arn
  batch_size              = 1
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config { maximum_concurrency = 2 }
  enabled    = true
  depends_on = [aws_iam_role_policy.notifications, aws_sns_topic_subscription.notifications]
}
# Exact endpoint requested by the exercise, in addition to /api/notifications/send.
resource "aws_apigatewayv2_route" "notifications" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /notifications/send"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
resource "aws_lambda_permission" "notifications_route" {
  statement_id  = "AllowNotificationsRoute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/POST/notifications/send"
}
