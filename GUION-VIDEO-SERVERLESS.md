# Video de demostración · objetivo 10 minutos

Graba después de obtener una ejecución real exitosa del pipeline. Prepara las pestañas antes de iniciar. El video demuestra un despliegue real; no marques como exitoso un job pendiente o fallido.

| Tiempo | Qué mostrar | Qué explicar |
| --- | --- | --- |
| 0:00–0:45 | App, esquema y repositorio | React Native consume HTTPS → API Gateway → Lambda → Neon PostgreSQL. GitHub Actions despliega mediante Terraform. |
| 0:45–2:30 | `terraform/provider.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars` | Java 21, adaptador HTTP v2, IAM de Lambda, logs con retención, URL de salida y estado remoto S3. tfvars no tiene secretos. |
| 2:30–3:15 | Repositorio y commits reales | Separación mobile/backend/terraform/workflow. Explicar los cambios registrados, sin inventar PR si no se utilizó. |
| 3:15–5:15 | Workflow y ejecución de Actions | Push a main, pruebas PostgreSQL, ZIP Lambda, Init/Validate/Plan/Apply y prueba funcional del despliegue. Mostrar pasos verdes y URL en Summary. |
| 5:15–6:30 | AWS Lambda, API Gateway y CloudWatch | Función creada por Terraform, ruta `/api/{proxy+}`, invocaciones y logs. No mostrar valores de variables de entorno Lambda. |
| 6:30–9:30 | iPhone con URL HTTPS | Login ADMIN; crear, consultar, modificar y eliminar usuario temporal; actualizar en paralelo; subir foto y volver a verla. |
| 9:30–10:00 | Código y conclusión técnica | MVVM en el móvil; puertos/adaptadores en API. Cambió el despliegue, se conservaron casos de uso y permisos. |

## Antes de grabar

- Ejecuta el pipeline completo y deja disponible la ejecución exitosa.
- Para mostrarlo activándose automáticamente, prepara un cambio real pequeño en documentación, haz commit/push a `main` y enseña el inicio. La ejecución puede tardar más que la duración del video: usa un corte claramente señalado o muestra una ejecución ya terminada; no finjas tiempos ni resultados.
- En Settings → Secrets and variables → Actions muestra **solo los nombres**. No abras formularios con valores ni reveles Access Keys, DATABASE_URL, JWT o contraseñas.
- Usa una cuenta de prueba y una foto de muestra sin información personal.
- Inicia Expo y carga la app antes. Con AWS no necesitas iniciar Java local, pero Expo Go todavía necesita obtener el bundle del móvil.
- Comprueba que la URL de la app sea `https://...execute-api...amazonaws.com`, no la IP local.

## Frases que puedes explicar con el código abierto

**Terraform:** «Describe los recursos que necesito. Plan muestra diferencias y Apply realiza esos cambios. El estado remoto permite que los siguientes runners reconozcan los mismos recursos».

**Lambda:** «Spring Boot no recibe directamente una conexión Tomcat desde API Gateway. El adaptador convierte el evento HTTP v2 en una petición para los controladores existentes y convierte la respuesta de vuelta».

**CI/CD:** «El push activa el workflow. Primero prueba y empaqueta; después aplica el plan guardado. Terraform actualiza la Lambda al cambiar el hash del ZIP. Finalmente se prueban operaciones reales contra la URL desplegada».

**Archivos:** «La app envía multipart con JWT. API Gateway representa el cuerpo binario en Base64 dentro del evento; el adaptador lo reconstruye. La API valida y guarda la imagen en PostgreSQL y la devuelve con autorización».

**Secretos:** «GitHub Secrets entrega los valores durante el job. No están en el repositorio ni en el móvil. Terraform los marca sensibles, pero el estado conserva esos valores, por eso S3 tiene acceso restringido y cifrado».

**Concurrencia:** «El ViewModel inicia perfil y lista antes de esperar. `Promise.allSettled` permite conservar el resultado de una consulta aunque la otra falle».

## Evidencia que debe quedar visible

- URL del repositorio y commits.
- Workflow correcto `.github/workflows/deploy.yml`.
- Nombres de los siete Secrets de esta implementación y variable del bucket.
- Build/Test, Terraform Plan/Apply y verificación Deploy Lambda en verde.
- Recursos reales AWS, no solo archivos HCL.
- App consumiendo AWS y realizando CRUD/upload.

Si algo falla en vivo, muestra el estado real y explica cómo lo diagnosticas. Una prueba local o un plan con proveedores simulados no sustituye la evidencia AWS.
