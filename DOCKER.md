# Backend y PostgreSQL con Docker

La app móvil se ejecuta en el iPhone. Docker ejecuta dos servicios en la PC: la API Java y PostgreSQL. La imagen de la API usa un proceso Java sin privilegios y una construcción en dos etapas; su construcción ejecuta las pruebas.

## 1. Comprobar Docker

```powershell
docker version
```

Debe mostrar Client **y Server** sin error. Si aparece `Docker Desktop is unable to start`, todavía debes resolver Docker/virtualización o utilizar otro equipo con Docker operativo. Puedes seguir desarrollando con PostgreSQL instalado, pero para demostrar este requisito debes ejecutar los contenedores al menos una vez.

## 2. Preparar configuración

Abre PowerShell en `backend`:

```powershell
Copy-Item .env.example .env
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

Edita `.env`:

- `JWT_SECRET`: cadena Base64 recién generada, sin comillas.
- `DB_PASSWORD`: contraseña nueva, aleatoria, solo para la base del contenedor.
- `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`: cuenta administradora de esta base nueva. Contraseña entre 12 caracteres y 72 bytes UTF-8.
- `BOOTSTRAP_ADMIN_ENABLED=true` solo para inicializar la cuenta.
- `API_BIND=0.0.0.0` para acceder desde el iPhone en una red privada de confianza.
- `API_PORT=8080`; detén la API local que ocupe ese puerto, o elige otro.

No entregues `.env`. Para simplificar el formato de Compose, usa valores alfanuméricos aleatorios de suficiente longitud sin `$`, `#` ni espacios.

## 3. Construir y arrancar

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Espera `Started UsuariosApplication`. Ctrl+C sale de los logs, no detiene los contenedores. Inicia sesión en la app contra `http://IP-DE-LA-PC:8080` con el administrador de `.env`.

La base del contenedor es **independiente** de tu PostgreSQL instalado: empieza vacía y Flyway crea V1 y V2. No expone 5432 al host; así evita conflictos con tu PostgreSQL de Windows. Los datos y fotos persisten en el volumen `postgres_data`. No hay que crear tablas manualmente.

Una vez creado el administrador, puedes poner `BOOTSTRAP_ADMIN_ENABLED=false` y recrear el servicio API. Esto no elimina la cuenta existente.

## 4. Comprobar las pruebas con PostgreSQL

```powershell
.\mvnw.cmd -Ppostgres-test verify
```

Testcontainers crea una base desechable para las pruebas. Nunca ejecutes las pruebas destructivas de integración contra una base con datos que quieras conservar.

## 5. Detener

```powershell
docker compose down
```

Los datos se conservan. `docker compose down -v` elimina el volumen y todos los usuarios/fotos; no es necesario para la presentación.

## Evidencia para clase

Muestra `Dockerfile`, `compose.yaml`, `docker compose ps`, logs de migraciones y una petición desde el iPhone o Postman al contenedor. No muestres secretos de `.env` ni el contenido del JWT en capturas públicas.

Estado de esta entrega: archivos Docker preparados; el daemon Docker de esta PC no ha permitido verificar la construcción/ejecución del contenedor. La API se probó por separado, como se detalla en `VALIDACION.md`.
