# Mensajería desacoplada: SNS, SQS, Lambda y correo

## Qué se agregó

Móvil → POST /notifications/send → API Gateway → backend Spring Boot → SNS directorio-notifications → SQS directorio-notifications → notification-lambda → Amazon SES → correo.

El endpoint requiere JWT de ADMIN. Mantiene también el alias /api/notifications/send. Un USER recibe 403; sin token, 401. La pantalla Enviar correo está disponible al administrador para evitar que el registro público convierta la API en un servicio abierto de envío de correo.

La respuesta HTTP 202 contiene notificationId, status QUEUED y «Mensaje enviado correctamente.». Significa que SNS aceptó el mensaje, no que el destinatario ya lo recibió. La pantalla explica esta diferencia. No envía mensajes automáticamente al registrar usuarios.

El backend conserva arquitectura hexagonal: SendNotificationUseCase → SendNotificationService → NotificationPublisher → SnsNotificationPublisher. El móvil conserva MVVM: NotificationInput, NotificationsRepository, NotificationsViewModel y NotificationsScreen.

El trabajador separado usa Python 3.13 y boto3 incluido en el runtime Lambda. El backend principal sigue en Java/Spring Boot y el móvil en React Native/TypeScript. No se requieren contraseñas SMTP: el rol de Lambda autoriza ses:SendEmail para el remitente configurado.

## Paso 1. Actualizar la política de despliegue antes del push

La política anterior no tenía permisos para SNS, SQS, SES ni la segunda Lambda. En IAM → Policies → DirectorioDeploy → Edit → JSON, reemplaza el contenido por el archivo politica-ci.json generado para esta ampliación. Guarda la versión como predeterminada. Si AWS indica que ya hay cinco versiones, elimina una versión anterior no predeterminada desde la pestaña de versiones y vuelve a guardar.

El archivo se genera con:

```powershell
cd "C:\Users\polan\Documents\Proyectos\Directorio"
python .\scripts\create-deploy-policy.py --account 548932260540 --region us-east-2 --bucket directorio-tfstate-jaysonssj3-20261004 | Set-Content -Encoding UTF8 politica-ci.json
```

politica-ci.json está excluido de Git. No modifica automáticamente IAM: hay que pegarlo en la consola. Los permisos de envío y consumo en los roles de ejecución son independientes de los permisos de despliegue. Las operaciones de administración de event source mappings y verificación SES quedan limitadas a Ohio mediante aws:RequestedRegion.

## Paso 2. Subir los cambios

No cambies los siete secretos existentes ni el bucket. El correo remitente público se configura en terraform/terraform.tfvars como notification_sender_email = "polancojayson@gmail.com".

```powershell
cd "C:\Users\polan\Documents\Proyectos\Directorio"
git status
git add backend mobile notification-lambda terraform scripts .github README.md NOTIFICACIONES-PASO-A-PASO.md NOTIFICACIONES-VALIDACION.md
git commit -m "Agregar notificaciones asincronas con SNS SQS Lambda y SES"
git push
```

Si git status muestra cambios ajenos a esta actividad, revísalos antes del commit. El push inicia pruebas Java, TypeScript y Python, genera los dos ZIP y despliega mediante Terraform. Si falla, revisa el primer error; no borres los recursos ni el estado.

## Paso 3. Verificar el correo SES

Terraform crea la identidad de SES y AWS envía un correo de verificación a polancojayson@gmail.com. Abre ese correo y confirma el enlace (revisa spam). En Amazon SES, región Ohio/us-east-2 → Configuration → Verified identities, comprueba estado Verified.

La verificación es regional. Si tu cuenta está en SES sandbox, también debe estar verificado el destinatario. Para empezar, usa polancojayson@gmail.com tanto como remitente como destinatario; basta verificar esa identidad. Para otro destinatario, crea y verifica su identidad en SES o solicita acceso de producción. No solicites acceso de producción solo para la demostración.

Sandbox limita por defecto a 200 correos/día y 1 correo/segundo. Envía las pruebas de una en una. El trabajador usa concurrencia máxima 2; SES puede limitar ráfagas, que se reintentarán a través de SQS. Terraform no puede abrir el enlace de tu buzón por ti.

Una ejecución verde comprueba despliegue y regresión del CRUD. No demuestra por sí sola recepción de correo: no enviamos mensajes de correo reales en cada push.

## Paso 4. Probar desde el iPhone

1. Ejecuta Iniciar-Mobile.cmd y vuelve a cargar el proyecto en Expo Go.
2. Usa https://wk1ewnduk3.execute-api.us-east-2.amazonaws.com como backend.
3. Inicia sesión con tu ADMIN cloud.
4. Pulsa Enviar correo.
5. Correo destino: polancojayson@gmail.com. Asunto: Prueba SNS SQS. Mensaje: Hola desde AWS Serverless.
6. Pulsa Enviar correo una sola vez. Guarda la referencia notificationId que aparece.
7. Revisa el buzón y spam. La entrega no es instantánea.

Ejemplo para Postman: POST https://wk1ewnduk3.execute-api.us-east-2.amazonaws.com/notifications/send, Authorization Bearer con tu JWT ADMIN, Body raw JSON:

```json
{"email":"polancojayson@gmail.com","subject":"Prueba SNS SQS","message":"Hola desde AWS Serverless"}
```

## Paso 5. Evidencias de esta actividad

1. Terraform main.tf: topic, queues, policy SNS→SQS, subscription, Lambda, IAM y aws_lambda_event_source_mapping. Variables y outputs públicos.
2. SNS en Ohio: topic directorio-notifications y suscripción SQS Confirmed. En Monitoring, NumberOfMessagesPublished y NumberOfNotificationsDelivered después de enviar. SNS no es un buzón donde puedas leer mensajes anteriores.
3. SQS: cola directorio-notifications, trigger Lambda y métricas NumberOfMessagesSent, NumberOfMessagesReceived y NumberOfMessagesDeleted. Una cola vacía es normal si Lambda consumió el mensaje rápido. No pulses Receive messages para capturarlo: competirías con el consumidor.
4. Lambda principal directorio-api y segunda Lambda notification-lambda: diagrama con SQS, configuración del trigger y estado Enabled.
5. CloudWatch /aws/lambda/directorio-api: evento notification_published con notificationId y snsMessageId. CloudWatch /aws/lambda/notification-lambda: notification_received y email_accepted_by_ses con el mismo notificationId, sqsMessageId y sesMessageId. No se registran destinatario, asunto ni cuerpo.
6. GitHub Actions: pruebas de las tres partes y Terraform Init/Validate/Test/Plan/Apply verdes. La segunda Lambda se despliega dentro de Terraform Apply.
7. Móvil: formulario, confirmación y referencia.
8. Buzón: correo recibido con remitente, asunto, texto y fecha. SES aceptando el mensaje no garantiza llegada al inbox; la evidencia final es el correo recibido.

Las métricas pueden tardar varios minutos. Conserva la hora de la prueba y usa ese intervalo en CloudWatch.

## Recuperación de errores

La visibilidad SQS es 180 segundos para una Lambda de 30 segundos. ReportBatchItemFailures hace que solo se reintenten los elementos fallidos. Después de cinco recepciones fallidas, pasan a directorio-notifications-dlq, retenida 14 días. La cola principal retiene cuatro días.

Si no llega el correo: verifica identidad SES en Ohio, sandbox/destinatario, logs de notification-lambda y cola DLQ. Corrige la causa antes de redirigir los mensajes de la DLQ a la cola original. No purgues la cola para ocultar errores.

SQS Standard entrega al menos una vez: pueden existir duplicados, especialmente si SES acepta el correo y la ejecución falla antes de confirmar SQS. Esta versión no promete envío exactamente una vez. notificationId sirve para correlación, no es una deduplicación persistente. Para producción se debe diseñar el control de duplicados y el seguimiento de rebotes/entregas.

Si la API devuelve error tras una interrupción de red, una repetición manual también puede generar otro mensaje. La pantalla bloquea doble pulsación mientras espera, pero no garantiza idempotencia entre solicitudes.

## Referencias

- https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html
- https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
- https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html

## Estado de entrega

Código e infraestructura preparados localmente. El despliegue de esta ampliación, la verificación SES y la recepción real de un correo siguen pendientes hasta completar los pasos de esta guía. Las capturas y el video de la actividad anterior no sustituyen estas nuevas evidencias.
