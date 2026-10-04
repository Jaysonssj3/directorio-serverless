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
      DATABASE_URL             = var.database_url
      JWT_SECRET               = var.jwt_secret
      SPRING_PROFILES_ACTIVE   = "lambda"
      BOOTSTRAP_ADMIN_ENABLED  = tostring(var.admin_email != "" && var.admin_password != "")
      BOOTSTRAP_ADMIN_EMAIL    = var.admin_email
      BOOTSTRAP_ADMIN_PASSWORD = var.admin_password
      JAVA_TOOL_OPTIONS        = "-XX:+TieredCompilation -XX:TieredStopAtLevel=1"
    }
  }
  depends_on = [aws_iam_role_policy.logs]
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
