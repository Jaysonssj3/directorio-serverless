mock_provider "aws" {}

run "serverless_plan" {
  command = plan
  variables {
    aws_region   = "us-east-1"
    database_url = "postgresql://test:temporary@db.example.com/test?sslmode=require"
    jwt_secret   = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
  }
  assert {
    condition     = aws_lambda_function.api.runtime == "java21"
    error_message = "Lambda debe ejecutar el paquete Java 21."
  }
  assert {
    condition     = aws_apigatewayv2_integration.lambda.payload_format_version == "2.0"
    error_message = "El adaptador espera eventos HTTP API v2."
  }
  assert {
    condition     = aws_cloudwatch_log_group.lambda.retention_in_days == 7
    error_message = "Debe existir retención limitada de logs."
  }
  assert {
    condition     = aws_iam_role.lambda.name == "directorio-lambda"
    error_message = "El rol de ejecución debe pertenecer al proyecto."
  }
}
