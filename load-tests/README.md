# Pruebas de carga

Herramienta: k6 local. Endpoint: `POST /notifications/send`, autenticación ADMIN. Las nuevas pruebas conservan asunto y mensaje de la actividad y usan el simulador de SES como destinatario:

```json
{"email":"success@simulator.amazonses.com","subject":"Prueba","message":"Mensaje de carga"}
```

## Alcance y condiciones

La arquitectura observada incluye API Gateway, Lambda Java, SNS, SQS y Lambda Python. También intervienen PostgreSQL (consulta del usuario para autorizar cada solicitud) y SES (envío final).

El código Terraform actual configura API Gateway a 5 solicitudes/s con ráfaga de 10; el consumidor SQS tiene lote de 1 y máximo 2 ejecuciones. Son límites de configuración, no una medición de capacidad máxima. Confírmalos con el preflight antes de ejecutar. No se modifican en estas pruebas.

La primera medición usó `test@test.com` y se conserva sin cambios: 286 solicitudes aceptadas terminaron en DLQ tras cinco intentos. Las siguientes usan `success@simulator.amazonses.com`, autorizado para las pruebas. El simulador funciona en sandbox sin verificar ese destinatario y no consume la cuota diaria, pero conserva la tasa máxima de envío (actualmente 1/s). No llega un correo a Gmail: el éxito se comprueba con los eventos SES y el procesamiento de SQS.

El cambio de destinatario debe figurar en el informe. No borres ni redirijas automáticamente los 286 mensajes antiguos de la DLQ. Para una nueva prueba hay que decidir y documentar su tratamiento: el monitor actual exige DLQ vacía, por lo que no puede declarar recuperación completa mientras permanezcan allí.

## 1. Comprobación AWS sin claves locales

En la consola AWS selecciona Ohio y abre CloudShell (icono de terminal). En Actions de CloudShell, usa Upload file para subir `aws_metrics.py` y `config.json` de esta carpeta al mismo directorio. Ejecuta:

```bash
python3 aws_metrics.py preflight --out preflight
```

Usa Actions → Download file para descargar `preflight/preflight.json`. El script utiliza la sesión AWS de CloudShell y boto3. Si boto3 no está disponible: `python3 -m pip install --user boto3`. Si aparece AccessDenied, registra la operación rechazada; el script no cambia roles ni recursos. Las lecturas necesarias son: API Gateway GetStage, Lambda GetFunctionConfiguration/ListEventSourceMappings, SES GetIdentityVerificationAttributes/GetSendQuota, SQS GetQueueUrl/GetQueueAttributes, CloudWatch GetMetricData y Logs FilterLogEvents.

Antes de cada escenario, comprueba que no hay mensajes visibles, en vuelo o retrasados en la cola principal ni en la DLQ. Si hay mensajes antiguos, no mezcles pruebas ni purgues las colas: identifica y resuelve el fallo primero.

## 2. Instalar k6

En PowerShell:

```powershell
winget install k6 --source winget
```

Abre una nueva terminal y ejecuta `k6 version`. Necesitas también Python 3. El script solicita la contraseña del ADMIN de la aplicación de forma oculta; no la pongas en el código ni la envíes por chat.

## 3. Línea base y carga progresiva

Desde la raíz del proyecto:

```powershell
python load-tests/run.py --vus 10
```

Son 10 usuarios durante 60 segundos. El login y la consulta de identidad se hacen antes del intervalo medido. Cada ejecución obtiene un JWT nuevo. Cada usuario realiza una solicitud, espera su respuesta y descansa 1 segundo; es un modelo cerrado y VU no equivale a solicitudes/s. Se utiliza la misma cuenta ADMIN para todos los VU; documenta esta limitación frente a usuarios reales distintos.

Una vez revisados los resultados y la recuperación, ejecuta por separado:

```powershell
python load-tests/run.py --vus 50
python load-tests/run.py --vus 100
python load-tests/run.py --vus 250
python load-tests/run.py --vus 500
```

Cada escenario dura 120 segundos, más hasta 31 segundos para terminar solicitudes pendientes. No pegues todos los comandos de una vez: monitorea AWS y verifica recuperación entre pruebas. La pausa se conserva en 1 segundo; `--pause` permite otra configuración, que debe declararse y mantenerse para comparar escenarios.

Resultados en `load-tests/results/FECHA-Nvu/`:

- `run.json`: horario UTC, configuración, versión k6, duración real y código de salida.
- `summary.json`: media, mínimo, máximo, P95/P99 y errores.
- `samples.json`: muestras temporales originales de k6.
- `notification-ids.json`: IDs aceptados para correlación.
- `k6.log`: salida de la herramienta, sin tokens ni contraseña.

Los resultados están excluidos de Git por tamaño; adjunta al informe los CSV/gráficas y capturas elegidos. Un código k6 distinto de cero puede indicar umbrales incumplidos o una interrupción; revisa el log. Una ejecución detenida no cuenta como escenario de duración completa.

## 4. Monitorear y capturar

En AWS abre las métricas de API Gateway, ambas Lambdas, SNS y SQS. Usa el intervalo UTC de `run.json`. El API es HTTP API: sus errores se llaman `4xx` y `5xx`.

| Servicio | Métricas y estadística |
| --- | --- |
| API Gateway | Count (Sum), Latency/IntegrationLatency (Average), 4xx/5xx (Sum) |
| Lambda principal | Invocations/Errors/Throttles (Sum), Duration (Average), ConcurrentExecutions (Maximum) |
| SNS | NumberOfMessagesPublished/NumberOfNotificationsDelivered/NumberOfNotificationsFailed (Sum) |
| SQS principal y DLQ | NumberOfMessagesSent/Received/Deleted (Sum), visibles/en vuelo/retrasados/edad (Maximum) |
| Lambda notificaciones | ConcurrentExecutions (Maximum), Duration (Average), Errors/Throttles (Sum) |

La tasa de error del API es `(4xx + 5xx) / Count * 100` para el mismo intervalo; sin solicitudes no se calcula. No promedies promedios o percentiles de varios minutos para obtener el global: usa el resumen k6 para las latencias globales. Las métricas AWS tienen períodos de 60 segundos, pueden llegar tarde y pueden incluir login o actividad ajena si coinciden en el mismo minuto. Un dato ausente no significa cero.

Espera unos minutos después de terminar y captura desde CloudShell (sustituye las fechas):

```bash
python3 aws_metrics.py capture --start 2026-10-18T15:00:00Z --end 2026-10-18T15:05:00Z --out baseline
```

Descarga `baseline/metrics.json` y `baseline/events.jsonl`. Repite la captura del mismo intervalo si faltan puntos por demora de publicación. Para la recuperación, incluye también su intervalo en una segunda captura.

Capturas mínimas: API Gateway Metrics, directorio-api Metrics, SNS Metrics, SQS principal y DLQ, notification-lambda Metrics y logs de ambas Lambdas. En las capturas deben verse recurso, intervalo y estadística.

Busca `notification_published`, `notification_received`, `notification_failed` y `email_accepted_by_ses`. Con fallos parciales de SQS, Lambda puede terminar sin excepción aunque falle un correo: `Errors=0` no demuestra éxito del consumidor. Los reintentos repiten IDs; compara IDs únicos. La ausencia de un evento dentro de una ventana corta no prueba pérdida de mensajes.

## 5. Estrés

Ejecuta escalones independientes de 2 minutos, empezando por 100 y continuando con 250, 500, 750, 1000, 1500 y 2000 solo si el anterior no alcanzó los criterios de parada:

```powershell
python load-tests/run.py --vus 100 --stress
```

El script interrumpe ante más de 5% de errores acumulados o alguna respuesta superior a 5000 ms; empieza a evaluar después de 10 segundos para evitar muestras iniciales insuficientes. La evaluación de k6 no es instantánea. El umbral usa el máximo, no la media. Los errores 401/403 detienen cualquier prueba por autenticación inválida.

Monitorea AWS durante la prueba y pulsa Ctrl+C si aparece `Throttles > 0` en cualquiera de las Lambdas o si SQS alcanza 500 mensajes visibles. Este valor es el criterio operativo elegido de acumulación, no un límite físico de SQS. La parada por AWS es manual porque la PC no tiene credenciales; las métricas de CloudWatch llegan con retraso. Si no puedes mantener esa supervisión, no inicies el estrés.

Si ya hubo degradación con 10 usuarios, registra ese resultado y el límite configurado; no declares que soporta 100 usuarios ni ejecutes 2000 automáticamente. La generación de carga y los reintentos consumen recursos AWS. No se ejecutan cargas desde GitHub Actions.

## 6. Recuperación

Al detener k6, anota `end_utc` de `run.json`. Inmediatamente ejecuta en CloudShell:

```bash
python3 aws_metrics.py recovery --start FECHA_UTC_DE_FIN --out recovery
```

El script lee los conteos aproximados cada 10 segundos, hasta 30 minutos. Exige 3 observaciones seguidas con cola principal y DLQ vacías, incluidos mensajes en vuelo y retrasados. No consume ni elimina mensajes. Si no se vacían, el resultado es «no recuperado en el intervalo», no cero segundos. Si comienzas tarde, la medición es una cota superior desde el fin de carga.

Además revisa que concurrencia, duración y errores de ambas Lambdas vuelvan al nivel previo en las métricas, y registra su hora. Una cola principal vacía con mensajes en DLQ es traslado de fallos, no recuperación exitosa. Corrige el destinatario/SES antes de redirigir mensajes; no purgues para aparentar recuperación.

## 7. Tabla, gráficas e informe

```powershell
python load-tests/report.py
```

Genera `results.csv`, `results.md` y `performance.svg` únicamente a partir de ejecuciones reales. El throughput incluye errores; `accepted_rps` indica solicitudes aceptadas. Usa `INFORME.md` para redactar el análisis y adjunta las capturas. Vigila CPU/RAM/red de la PC: si el generador se satura, no atribuyas esa limitación a AWS.

## Referencias

- https://grafana.com/docs/k6/latest/using-k6/thresholds/
- https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/
- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-metrics.html
- https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
- https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
