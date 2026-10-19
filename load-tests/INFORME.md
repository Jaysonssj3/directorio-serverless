# Pruebas de carga y análisis de rendimiento de una arquitectura Serverless en AWS

## 1. Objetivo

Evaluar el rendimiento de un sistema de notificaciones asíncronas, identificar sus límites bajo solicitudes concurrentes y comprobar su recuperación después de detener la carga.

## 2. Arquitectura evaluada

```text
Aplicación móvil / k6
        ↓
API Gateway
        ↓
Lambda principal
        ↓
       SNS
        ↓
       SQS ──→ DLQ
        ↓
Notification Lambda
        ↓
Amazon SES
```

API Gateway recibe las solicitudes y las dirige a la Lambda principal. Esta publica la notificación en SNS, que la entrega a SQS. Una segunda Lambda consume la cola y solicita el envío mediante SES.

La cola permite procesar las notificaciones después de responder al cliente. Por tanto, una respuesta HTTP 202 confirma la aceptación de la solicitud, pero no la entrega del correo.

La DLQ conserva los mensajes que agotan los intentos de procesamiento.

## 3. Herramienta y configuración

Se utilizó **k6**, con usuarios virtuales concurrentes y una pausa de un segundo entre solicitudes por usuario.

Endpoint:

```http
POST /notifications/send
```

Cuerpo utilizado en las pruebas comparativas:

```json
{
  "email": "success@simulator.amazonses.com",
  "subject": "Prueba",
  "message": "Mensaje de carga"
}
```

Inicialmente se utilizó `test@test.com`, como indicaba la actividad. Esa ejecución produjo 286 mensajes que terminaron en la DLQ sin aceptación por SES. Los registros mostraron `ClientError`, sin detallar el código específico del rechazo.

Posteriormente se cambió al simulador de SES para evaluar el procesamiento sin enviar correos a un buzón real. Este cambio se documenta como una desviación respecto al destinatario original de la actividad. Las pruebas con distintos destinatarios se analizaron por separado.

### Configuración relevante de AWS

| Componente | Configuración |
|---|---|
| Región | us-east-2 |
| API Gateway | 5 solicitudes/s; ráfaga de 10 |
| Concurrencia regional de Lambda | 10 |
| Lambda principal | Java 21, 1536 MB, timeout de 28 s |
| Notification Lambda | Python 3.13, 128 MB, timeout de 30 s |
| Integración SQS–Lambda | Lotes de 1, concurrencia máxima configurada de 2 |
| Visibilidad de SQS | 180 s |
| Política de reintentos | Máximo de 5 recepciones antes de DLQ |
| SES | Sandbox; cuota informada de 1 envío/s y 200 envíos diarios |

Los límites configurados forman parte de las condiciones del experimento. Los resultados no representan la capacidad máxima general de AWS.

## 4. Escenarios ejecutados

| Escenario | Usuarios | Duración | Estado |
|---|---:|---:|---|
| Línea base inicial con `test@test.com` | 10 | 1 minuto | Ejecutado |
| Línea base con simulador | 10 | 1 minuto | Ejecutado |
| Incremento progresivo | 50 | 2 minutos | Ejecutado |
| Incremento progresivo | 100 | 2 minutos | Ejecutado |
| Incremento progresivo | 250 | 2 minutos | Pendiente |
| Incremento progresivo | 500 | 2 minutos | Pendiente |
| Estrés independiente | Incremental | Hasta degradación | Pendiente |

Las ejecuciones con simulador finalizaron con código k6 **99**, porque incumplieron los umbrales configurados de errores y latencia máxima. Completaron sus duraciones previstas.

## 5. Resultados obtenidos

### Rendimiento HTTP con el simulador

Las latencias se expresan en milisegundos e incluyen respuestas exitosas y rechazadas.

| Métrica | 10 usuarios | 50 usuarios | 100 usuarios |
|---|---:|---:|---:|
| Solicitudes totales | 483 | 5.490 | 11.120 |
| Solicitudes aceptadas | 285 | 492 | 447 |
| Solicitudes/s | 7,91 | 45,35 | 91,85 |
| Solicitudes aceptadas/s | 4,67 | 4,06 | 3,69 |
| Latencia promedio | 249,06 | 95,17 | 81,07 |
| Latencia mínima | 54,32 | 53,78 | 48,02 |
| Latencia máxima | 9.891,70 | 8.981,91 | 8.062,83 |
| P95 | 140,84 | 129,05 | 105,20 |
| P99 | 7.898,49 | 519,38 | 133,12 |
| Tasa de errores | 40,99 % | 91,04 % | 95,98 % |
| Respuestas 429 | 197 | 4.843 | 10.454 |
| Respuestas 503 | 1 | 155 | 219 |

El descenso de la latencia global no representa una mejora: al aumentar la carga, predominan respuestas rápidas de rechazo.

La latencia promedio de las solicitudes aceptadas fue de **370,50 ms, 235,88 ms y 260,43 ms**, respectivamente.

### Procesamiento asíncrono

| Métrica | 10 usuarios | 50 usuarios | 100 usuarios |
|---|---:|---:|---:|
| Publicaciones en SNS | 285 | 492 | 447 |
| Entregas de SNS | 285 | 492 | 447 |
| Aceptaciones por SES | 285 | 492 | 447 |
| Intentos fallidos registrados | 46 | 125 | 102 |
| Throttles de Lambda principal | 1 | 155 | 219 |
| Throttles de Notification Lambda | 1 | 2 | 5 |
| Nuevos mensajes observados en DLQ | 0 | 0 | 0 |

Los identificadores de las solicitudes aceptadas se cotejaron con los registros de publicación, recepción y aceptación por SES. No se encontraron mensajes aceptados ausentes en esa secuencia.

La DLQ conservó **286 mensajes anteriores**, procedentes de la primera prueba. Se trataron como estado inicial, no como fallos nuevos.

## 6. Recuperación

Se midió el tiempo transcurrido desde el cierre registrado de cada prueba.

| Escenario | Última aceptación por SES después del cierre | Cola principal observada vacía |
|---|---:|---:|
| 10 usuarios | 4 min 21 s | 5 min 9 s |
| 50 usuarios | 7 min 7 s | 7 min 52 s |
| 100 usuarios | 7 min 4 s | 7 min 12 s |

Las consultas a SQS fueron periódicas; por ello, la segunda columna de tiempos de recuperación de la cola indica el momento de observación, no el instante exacto del vaciado.

La recuperación de la cola y la aceptación por SES no demuestran por sí solas el tiempo exacto de recuperación de la concurrencia de las Lambdas.

## 7. Monitoreo y análisis de logs

Se recopilaron métricas de API Gateway, ambas Lambdas, SNS y SQS, junto con registros de CloudWatch.

Los eventos principales fueron:

- `notification_published`: publicación desde la API.
- `notification_received`: recepción por el consumidor.
- `notification_failed`: intento fallido.
- `email_accepted_by_ses`: aceptación de la solicitud de envío.

Las Lambdas registraron cero errores en la métrica `Errors` durante estas pruebas, aunque hubo fallos de procesamiento. El consumidor captura las excepciones y devuelve fallos parciales del lote, por lo que fue necesario revisar también los logs.

Los eventos `ClientError` no incluyen suficiente detalle para determinar la causa específica de cada intento fallido.

## 8. Cuellos de botella

El principal límite de admisión fue API Gateway, configurado en 5 solicitudes por segundo y una ráfaga de 10. Las respuestas 429 dominaron al incrementar los usuarios.

También se observó throttling en la Lambda principal, cuya concurrencia máxima alcanzó el límite regional de 10.

En el procesamiento posterior, SQS acumuló trabajo y permitió continuar después de detener k6. La capacidad del consumidor y las restricciones de SES condicionan el tiempo de drenaje. Sin embargo, los logs disponibles no permiten atribuir cada fallo a una cuota específica.

## 9. Recomendaciones

1. Ajustar el límite de API Gateway conforme a la capacidad real del sistema.
2. Solicitar una mayor cuota de concurrencia de Lambda y distribuirla entre productor y consumidor.
3. Coordinar la concurrencia del consumidor con la tasa permitida por SES.
4. Aplicar reintentos con espera progresiva y variación aleatoria para errores transitorios.
5. Registrar el código específico de error de AWS para distinguir cuotas, permisos y rechazos.
6. Incorporar idempotencia para evitar envíos duplicados durante reintentos.
7. Crear alarmas de throttling, errores HTTP, antigüedad de mensajes y crecimiento de la DLQ.
8. Repetir las pruebas después de cada ajuste, manteniendo constantes las demás condiciones.

## 10. Respuestas a las preguntas de análisis

**1. ¿Cuál fue el máximo número de usuarios concurrentes soportados?**

Se probaron hasta 100 usuarios. Ningún escenario evaluado cumplió el límite del 5 % de errores. Por tanto, no se determinó una cantidad de usuarios soportada satisfactoriamente; sería necesario probar cargas inferiores a 10 usuarios o ajustar los límites.

**2. ¿Cuál fue el tiempo de respuesta promedio?**

Fue de 249,06 ms con 10 usuarios, 95,17 ms con 50 y 81,07 ms con 100. Estos promedios incluyen rechazos rápidos y deben interpretarse junto con la tasa de errores.

**3. ¿Se produjo throttling en alguna Lambda?**

Sí, en ambas. La Lambda principal registró 1, 155 y 219 throttles; la de notificaciones registró 1, 2 y 5.

**4. ¿SNS perdió mensajes durante las pruebas?**

No se observó pérdida entre los mensajes aceptados en las pruebas con simulador. Las publicaciones y entregas coincidieron, y los identificadores se encontraron en los registros posteriores de aceptación por SES.

**5. ¿SQS logró absorber los picos de carga?**

Sí, para los mensajes que superaron la admisión de la API. Los almacenó mientras el consumidor los procesaba y terminó vaciándose. Esto no significa que el sistema aceptara todas las solicitudes de k6.

**6. ¿Cuál componente se convirtió en el cuello de botella?**

API Gateway fue el principal límite de admisión. También se alcanzó el límite de concurrencia de la Lambda principal. El procesamiento asíncrono agregó demora de recuperación.

**7. ¿Qué cambios realizaría para soportar el doble de tráfico?**

Ajustaría conjuntamente las cuotas de API Gateway, Lambda y SES; optimizaría el consumidor y evaluaría su concurrencia y tamaño de lote. Después repetiría las pruebas para verificar que el aumento de admisión no produzca una acumulación sostenida en SQS.

## 11. Conclusión

La arquitectura procesó mediante SES todas las notificaciones admitidas en las pruebas con simulador. SQS permitió conservar el trabajo pendiente y completar su procesamiento después de detener la carga.

Sin embargo, la tasa de errores HTTP aumentó del 40,99 % al 95,98 % al pasar de 10 a 100 usuarios. La configuración actual requiere ajustes antes de considerarse adecuada para esos niveles de concurrencia.

La evaluación es parcial: quedan pendientes los escenarios de 250 y 500 usuarios y una prueba de estrés independiente.
