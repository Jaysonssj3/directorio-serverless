# Validación de notificaciones — 11 de octubre de 2026

- Backend: 17 pruebas, 0 fallos, 0 errores. Incluye validación de JSON, publicación SNS con cliente simulado, fallo de publicación sin éxito falso, JWT/rol por el adaptador API Gateway y regresión CRUD/fotos con H2.
- Empaquetado Java: perfil lambda produjo ZIP con clases en raíz y librerías en lib.
- Mobile: TypeScript sin errores y 19 pruebas correctas; incluyen validación, bloqueo de pulsación duplicada y error de envío sin confirmación falsa.
- notification-lambda: 4 pruebas unitarias correctas con SES simulado; envío UTF-8, reintento parcial, campos inválidos y JSON malformado.
- Terraform: fmt y validate correctos; 2 pruebas plan con proveedor AWS simulado, incluyendo raw delivery, nombre de Lambda, visibilidad y fallos parciales.
- ZIP Python: contiene handler.py en raíz. boto3/botocore son los incluidos en el runtime administrado Python 3.13; no hay dependencias externas del trabajador que instalar.
- Política IAM generada para la cuenta y Ohio; requiere aplicación manual en IAM antes del push.

Limitación del entorno Windows: javac produjo clases pero informó AccessDenied al cerrar/consultar librerías. Se compiló una copia temporal fuera del proyecto; para la compilación de pruebas se incluyeron también las fuentes principales en la carpeta temporal de pruebas. Tras reintentar las fases, Maven verify terminó correctamente. El proyecto original conserva la estructura estándar, que GitHub Actions compilará en Linux.

No se ejecutó terraform apply ni se envió correo real desde este entorno. El estado de SNS/SQS/SES y la nueva Lambda en AWS está pendiente de despliegue. Las pruebas con mocks/H2 no sustituyen la recepción real de correo y las evidencias de CloudWatch. Tampoco se regeneró el JAR del lanzador local ni los ZIP históricos de entregas anteriores; esta actividad se despliega desde el código actualizado y GitHub Actions.
