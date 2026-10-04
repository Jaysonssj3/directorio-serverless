# Entrega serverless: desde tus cuentas hasta la app

## Estado actual

El código está preparado en esta carpeta: adaptador Lambda, Terraform, workflow y pruebas. **Todavía no hay despliegue AWS ni ejecución exitosa de GitHub Actions**, porque faltan el repositorio remoto, la cuenta AWS confirmada, la base cloud y sus Secrets. No se incluyen evidencias inventadas.

Tu API local y tu base de Windows siguen siendo independientes. La base cloud empezará vacía: no se envían tus datos locales a Neon automáticamente.

## 1. Crear la base Neon

1. Entra en https://neon.com y crea una cuenta; puedes utilizar GitHub para identificarte.
2. Crea un proyecto llamado `directorio`. Elige una región cercana a la región AWS que usarás (por ejemplo, AWS `us-east-1`).
   Si puedes elegir versión PostgreSQL, usa **17**, que coincide con la base de CI y la versión probada oficialmente por el Flyway incluido.
3. Abre **Connect** en el proyecto. Selecciona la base, el rol y conexión PostgreSQL. Usa una conexión **directa**, no pooler, para esta práctica: el mismo proceso ejecuta migraciones Flyway y Hikari limita cada instancia a dos conexiones.
4. Copia la cadena con forma `postgresql://USUARIO:CONTRASEÑA@HOST/BASE?sslmode=require`. Puede incluir `channel_binding=require`. **Es un secreto**, no la pegues en el código, en tfvars ni en el video.
5. Guárdala después como `DATABASE_URL` en GitHub Secrets. No agregues `jdbc:`. El backend convierte la URI a JDBC, decodifica las credenciales y exige TLS con verificación de certificado/hostname.

Referencia: [conectar Neon](https://neon.com/docs/connect/connect-from-any-app).

## 2. Confirmar la cuenta AWS

Entra en https://console.aws.amazon.com y confirma que puedes acceder. Selecciona una región, por ejemplo `us-east-1`, y úsala en toda la configuración. AWS y Neon pueden generar cargos según uso/plan; revisa facturación y configura un presupuesto antes de desplegar. No asumas que todo será gratuito.

No uses claves del usuario root. Usa IAM para una identidad de despliegue del proyecto. Su rol es diferente del rol que Terraform crea para ejecutar Lambda:

- **Usuario IAM de CI:** crea/actualiza los recursos desde GitHub Actions.
- **Rol Lambda:** la función lo utiliza para escribir en su grupo de CloudWatch. No necesita administrar AWS.

## 3. Preparar una sola vez el bucket de estado

Terraform necesita recordar qué recursos ya creó. El runner de GitHub es temporal; por eso el estado se guarda en S3, con bloqueo y cifrado.

Ruta sencilla desde la consola AWS:

1. S3 → Create bucket.
2. Nombre único, por ejemplo `directorio-tfstate-TU-ID-DE-CUENTA`. Anota el nombre exacto.
3. Misma región que Lambda.
4. Mantén **Block all public access** activado.
5. Activa **Bucket Versioning** y cifrado por defecto SSE-S3.
6. No subas manualmente claves ni `.env` al bucket.

Alternativa si quieres crear también este bucket mediante Terraform: `terraform/bootstrap/main.tf`. Con Terraform y credenciales locales de una identidad autorizada para crear S3, ejecuta desde esa carpeta:

```powershell
terraform init
terraform plan -var="aws_region=us-east-1" -var="state_bucket_name=NOMBRE-UNICO"
terraform apply -var="aws_region=us-east-1" -var="state_bucket_name=NOMBRE-UNICO"
```

**Elige una sola ruta:** consola o bootstrap; no crees el mismo bucket dos veces. Si usas bootstrap, conserva su estado local en privado; está excluido de Git. El bootstrap impide destruir el bucket por accidente.

El estado principal en S3 contiene secretos de las variables de entorno Lambda aunque Terraform los oculte en pantalla. El acceso al bucket debe ser restringido. No entregues estados ni planes guardados. [Backend S3 de Terraform](https://developer.hashicorp.com/terraform/language/backend/s3).

## 4. Crear permisos y claves para GitHub Actions

Abre PowerShell en la carpeta `Directorio`. Genera la política con **tu ID AWS de 12 dígitos**, región y bucket:

```powershell
python .\scripts\create-deploy-policy.py --account TU_ID_DE_12_DIGITOS --region us-east-1 --bucket NOMBRE-DEL-BUCKET > politica-ci.json
```

En AWS IAM:

1. Policies → Create policy → JSON. Pega el contenido de `politica-ci.json` y crea `DirectorioDeploy`.
2. Users → Create user → `directorio-ci`. Asigna esa política. No requiere acceso a la consola.
3. Security credentials → Create access key para el uso desde GitHub Actions.
4. Guarda temporalmente Access key ID y Secret access key para el paso de Secrets. No las grabes en video, no las pegues en Git y no uses claves root.

La política limita Lambda, IAM, logs y estado al proyecto. API Gateway necesita permisos para crear una API cuyo ID todavía no existe; su alcance es regional. Si cambias `project_name` de `directorio`, también debes ajustar la política. No reemplaces un error de permisos concediendo automáticamente AdministratorAccess.

Para producción es preferible OIDC con credenciales temporales. Esta práctica utiliza las claves de GitHub Secrets porque así lo exige el enunciado.

## 5. Crear el repositorio GitHub

1. En GitHub, New repository → nombre sugerido `directorio-serverless`.
2. Crea un repositorio **vacío**, sin README, licencia ni gitignore automáticos; esos archivos ya se preparan localmente.
3. Elige la visibilidad que permita la corrección del profesor. Si es privado, dale acceso.
4. Copia la URL HTTPS. No hagas push todavía: configura primero los Secrets y la variable siguiente para evitar una ejecución incompleta.

## 6. Configurar GitHub Secrets

En el repositorio: **Settings → Secrets and variables → Actions → Secrets → New repository secret**.

| Nombre exacto | Valor |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | ID de la clave del usuario IAM de CI |
| `AWS_SECRET_ACCESS_KEY` | Clave secreta correspondiente |
| `AWS_REGION` | Por ejemplo `us-east-1` |
| `DATABASE_URL` | URI completa de Neon del paso 1 |
| `JWT_SECRET` | Base64 de 32 bytes aleatorios como mínimo |
| `BOOTSTRAP_ADMIN_EMAIL` | Correo del administrador de la base cloud |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña nueva, de 12 caracteres como mínimo y hasta 72 bytes UTF-8 |

Los cinco primeros son los exigidos por el enunciado. Los dos últimos permiten crear el primer ADMIN en la base cloud y ejecutar la comprobación automática de CRUD/upload. El arranque no reemplaza la contraseña de un ADMIN ya existente: conserva en Secrets la contraseña válida de esa cuenta para las pruebas de despliegue.

Genera JWT_SECRET en tu PowerShell **fuera de la grabación**:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

En la pestaña **Variables → New repository variable** crea:

```text
TF_STATE_BUCKET = nombre exacto del bucket S3
```

No hay que escribir esos valores en `terraform.tfvars`; ese archivo solo contiene el nombre público del proyecto. [Secrets en GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

## 7. Publicar el código y activar CI/CD

En PowerShell, dentro de `Directorio`:

```powershell
git status
git add .gitignore backend mobile postman Iniciar-Backend.cmd Iniciar-Backend.ps1 Iniciar-Mobile.cmd Iniciar-Mobile.ps1
git commit -m "API Lambda y aplicacion movil con JWT y archivos"
git add .
git commit -m "Terraform y despliegue automatico con GitHub Actions"
git log --oneline
git remote add origin https://github.com/TU_USUARIO/directorio-serverless.git
git push -u origin main
```

Reemplaza la URL por la real. Si `origin` ya existe, revisa `git remote -v` y no sobrescribas un destino distinto sin comprobarlo. Si Git solicita iniciar sesión, completa la autenticación normal de GitHub; no escribas un token dentro de la URL.

El repositorio local está inicializado, pero el entorno de preparación bloqueó la escritura de `.git/index.lock`; no se crearon commits. Los comandos anteriores registran cambios reales cuando los ejecutes en tu PowerShell. Si ya hiciste commits desde entonces, revisa primero el estado y no repitas pasos sin cambios.

Si Windows muestra `dubious ownership` para **esta carpeta que reconoces**, ejecuta una vez:

```powershell
git config --global --add safe.directory C:/Users/polan/Documents/Proyectos/Directorio
```

No uses `safe.directory '*'`.

## 8. Observar el pipeline

GitHub → Actions → **Test and deploy serverless**. Cada push a `main` lo ejecuta. Un PR ejecuta pruebas sin desplegar. `workflow_dispatch` permite volver a ejecutarlo manualmente desde `main`.

El flujo:

1. Instala dependencias Maven.
2. Ejecuta pruebas contra un PostgreSQL 17 desechable del runner.
3. Construye la API y empaqueta `usuarios-api-2.0.0-lambda.zip`.
4. Comprueba TypeScript y las pruebas móviles.
5. Descarga el ZIP en el job de despliegue.
6. Inicializa el estado S3 con bloqueo, valida Terraform y guarda un plan.
7. Ejecuta `terraform apply -auto-approve` sobre **ese mismo plan**.
8. Espera a Lambda y prueba la API HTTPS: login, permisos, CRUD y foto. Crea y elimina solo un usuario temporal.
9. Publica la URL real en el resumen de la ejecución. El plan no se publica como artifact y se elimina al terminar.

**Deploy Lambda ocurre dentro de Terraform Apply**. El paso siguiente verifica la actualización y el comportamiento; no ejecuta una segunda actualización de código fuera de Terraform.

La primera inicialización de Java o Neon puede tardar. La comprobación reintenta una lectura inicial sin efectos. Si hay errores, abre el paso rojo y CloudWatch. No reintentes creando recursos manualmente con nombres distintos.

## 9. Conectar el iPhone a AWS

Cuando el pipeline esté verde, copia su `API` del resumen. Se parecerá a:

```text
https://ID-REAL.execute-api.us-east-1.amazonaws.com
```

Esa dirección es solo un ejemplo; no se ha inventado una URL operativa.

En la app:

1. Sal de la sesión local.
2. En Dirección del backend pega la URL real HTTPS **sin `/api` al final**.
3. Entra con el ADMIN cloud de los Secrets, no necesariamente con el de PostgreSQL local.
4. Demuestra CRUD y foto.

La app permite la URL en pantalla. También admite `EXPO_PUBLIC_API_URL` en `mobile/.env` (usa `.env.example` como referencia) para definir un valor inicial; reinicia Expo después de cambiarlo. La preferencia guardada en el dispositivo tiene prioridad. No pongas secretos en variables `EXPO_PUBLIC_*`.

Con el backend en AWS, el iPhone usa internet para llegar a la API: ya no necesita que Java/PostgreSQL estén abiertos en tu laptop. **Expo Go aún necesita cargar el proyecto móvil** desde Metro; mantén tu modo de conexión de desarrollo o configura una distribución iOS firmada por separado. El workflow no publica la app en App Store.

## 10. Evidencia real y cierre

Completa `EVIDENCIA-SERVERLESS.md` con URLs y resultados reales. Usa `GUION-VIDEO-SERVERLESS.md` para el video de 8–12 minutos. Muestra solo nombres de Secrets, nunca sus valores, variables de entorno Lambda desplegadas ni contenido del estado.

Para retirar recursos después de la corrección: usa Terraform con el **mismo bucket, clave de estado y región**, revisa `terraform plan -destroy` y ejecuta `terraform destroy` de forma consciente. No borres primero el estado; perderías la relación entre configuración y recursos. La base Neon y el bucket de bootstrap se gestionan aparte. Revoca las claves de CI cuando dejen de ser necesarias.
