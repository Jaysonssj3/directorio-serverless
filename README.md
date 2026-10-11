# Directorio

Aplicación móvil de gestión de usuarios con React Native y TypeScript, API Spring Boot y PostgreSQL. Incluye autenticación JWT, roles, fotos de perfil y notificaciones por correo.

## Arquitectura

```text
Mobile → API Gateway → directorio-api → PostgreSQL
                            ↓
                           SNS → SQS → notification-lambda → SES → Correo
```

El backend utiliza arquitectura hexagonal; la aplicación móvil utiliza MVVM. La función de notificaciones procesa los mensajes de SQS independientemente de la solicitud HTTP.

## Estructura

- `backend/`: API Java 21, migraciones, configuración Docker y pruebas.
- `mobile/`: aplicación React Native, configuración Expo y pruebas.
- `notification-lambda/`: procesamiento de mensajes y envío mediante SES.
- `terraform/`: infraestructura AWS, roles IAM y grupos de CloudWatch.
- `.github/workflows/deploy.yml`: pruebas, empaquetado y despliegue.
- `scripts/`: empaquetado de notificaciones, política IAM de despliegue y comprobación de la API.
- `postman/`: colección para probar autenticación, usuarios y fotos.

## Ejecutar la aplicación móvil

Requiere Node.js 24 y Expo Go en el teléfono. Desde `mobile`:

```powershell
npm ci
npx expo start --lan --go
```

Conecta la PC y el teléfono a la misma red y escanea el QR. También puedes usar `Iniciar-Mobile.cmd` desde la raíz.

En la configuración de la aplicación, utiliza esta dirección del backend desplegado:

```text
https://wk1ewnduk3.execute-api.us-east-2.amazonaws.com
```

Para esta conexión no hace falta iniciar el backend local. El servidor Expo debe permanecer abierto durante el uso con Expo Go.

## Backend local

Requiere Java 21 o superior compatible y PostgreSQL. Consulta [backend/README.md](backend/README.md) para los endpoints y variables de configuración, o [DOCKER.md](DOCKER.md) para ejecutar con Docker.

Desde `backend`:

```powershell
.\mvnw.cmd verify
```

Después utiliza `Iniciar-Backend.cmd`, que solicita la contraseña de PostgreSQL. Para crear un administrador inicial:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Iniciar-Backend.ps1 -CrearAdministrador
```

La creación inicial no cambia la contraseña de un administrador existente. Los datos locales y los de AWS son independientes.

## Notificaciones

La pantalla **Enviar correo** está disponible para ADMIN. El endpoint requiere un JWT de administrador:

```http
POST /notifications/send
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "email": "polancojayson@gmail.com",
  "subject": "Prueba SNS",
  "message": "Hola desde AWS Serverless"
}
```

También existe el alias `/api/notifications/send`. La respuesta HTTP 202 contiene `notificationId`, estado `QUEUED` y el mensaje «Mensaje enviado correctamente.». Confirma la publicación en SNS; el correo se procesa después.

El remitente se configura con `notification_sender_email` en `terraform/terraform.tfvars`. Hay que verificarlo en SES, en la región del despliegue (`us-east-2`). Mientras SES permanezca en sandbox, el destinatario también debe estar verificado. No se necesita una contraseña SMTP.

Los registros permiten seguir un mismo `notificationId`:

- `/aws/lambda/directorio-api`: `notification_published`.
- `/aws/lambda/notification-lambda`: `notification_received` y `email_accepted_by_ses`.

La recepción se comprueba en el buzón del destinatario. Si falla, revisa esos registros y `directorio-notifications-dlq`. SQS reintenta los mensajes fallidos; tras cinco recepciones fallidas pasan a la cola de errores. La entrega es al menos una vez y pueden existir duplicados.

## Despliegue

El workflow de GitHub Actions ejecuta pruebas, genera los paquetes de ambas Lambdas y realiza `terraform init`, `terraform validate`, `terraform test`, `terraform plan` y `terraform apply -auto-approve` al publicar en `main`.

Configuración del repositorio:

| Tipo | Nombres |
| --- | --- |
| Secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `DATABASE_URL`, `JWT_SECRET`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` |
| Variable | `TF_STATE_BUCKET` |

`DATABASE_URL` es la URI PostgreSQL con TLS. `JWT_SECRET` debe ser Base64 de al menos 32 bytes aleatorios. No guardes credenciales en Git.

El estado principal utiliza un bucket S3 privado con versionado y la clave `directorio/app.tfstate`. Para una instalación nueva, `terraform/bootstrap/` permite crear el bucket antes del despliegue principal. No vuelvas a crear el bucket de una instalación existente.

La política de la identidad de despliegue se genera con:

```powershell
python scripts/create-deploy-policy.py --account ID_CUENTA --region us-east-2 --bucket NOMBRE_BUCKET > politica-ci.json
```

Esta política se asigna a la identidad IAM utilizada por GitHub Actions. Terraform crea los roles de ejecución de las Lambdas. Los archivos de estado, planes, credenciales y configuración privada están excluidos de Git.

## Pruebas

Desde `mobile`:

```powershell
npm run typecheck
npm test
```

Desde la raíz:

```powershell
python -m unittest discover -s notification-lambda -p "test_*.py" -v
python scripts/package-notifications.py
```

Desde `backend`, `mvn -Plambda verify` construye el paquete AWS. El pipeline prueba contra PostgreSQL y comprueba autenticación, permisos, CRUD y fotos después del despliegue. El envío real de correo se verifica por separado desde la aplicación y el buzón.
