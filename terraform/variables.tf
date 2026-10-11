variable "aws_region" {
  type        = string
  description = "Región elegida en AWS_REGION de GitHub Secrets."
}
variable "project_name" {
  type    = string
  default = "directorio"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "Usa 3-31 letras minúsculas, números o guiones."
  }
}
variable "database_url" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^postgres(ql)?://", var.database_url))
    error_message = "DATABASE_URL debe ser una URI PostgreSQL cloud."
  }
}
variable "jwt_secret" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.jwt_secret) >= 44
    error_message = "JWT_SECRET debe contener al menos 32 bytes aleatorios en Base64."
  }
}
variable "admin_email" {
  type      = string
  default   = ""
  sensitive = true
}
variable "admin_password" {
  type      = string
  default   = ""
  sensitive = true
  validation {
    condition     = var.admin_password == "" || length(var.admin_password) >= 12
    error_message = "La contraseña inicial debe tener al menos 12 caracteres."
  }
}
variable "lambda_zip" {
  type    = string
  default = "../backend/target/usuarios-api-2.0.0-lambda.zip"
}

variable "notification_sender_email" {
  description = "Correo remitente: confirmar el enlace SES en esta región antes de enviar."
  type        = string
  validation {
    condition     = can(regex("^[^@ ]+@[^@ ]+\\.[^@ ]+$", var.notification_sender_email))
    error_message = "Escribe un correo remitente válido."
  }
}
variable "notification_zip" {
  type    = string
  default = "../notification-lambda/dist/notification-lambda.zip"
}
