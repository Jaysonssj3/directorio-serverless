# Usuarios API 2.0.0

Spring Boot, PostgreSQL, JWT y arquitectura hexagonal. Conserva el CRUD y añade fotos de perfil. La aplicación React Native está en `../mobile`; comienza con `../INICIO-IPHONE.md`.

## Endpoints

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/auth/register` | Público: crea USER |
| POST | `/api/auth/login` | Público: devuelve JWT |
| GET | `/api/usuarios/me` | Autenticado |
| GET | `/api/usuarios?page=0&size=10` | ADMIN |
| POST | `/api/usuarios` | ADMIN |
| GET / PUT / DELETE | `/api/usuarios/{id}` | ADMIN |
| POST / GET | `/api/usuarios/me/avatar` | Autenticado, propia foto |
| POST / GET | `/api/usuarios/{id}/avatar` | ADMIN |

Crear: JSON `nombre`, `email`, `password`, `role`. Actualizar: JSON `nombre`, `email`. Login: JSON `email`, `password`. Registrar: `nombre`, `email`, `password`, sin rol. Las respuestas de usuario no incluyen contraseña/hash.

POST de avatar utiliza `multipart/form-data` con campo de archivo **archivo**. PNG/JPEG reales hasta 2 MB, máximo 4096 por lado y 4 millones de píxeles. Se recodifica PNG y almacena en `usuario_avatar`. No se confía en el nombre ni Content-Type declarado. GET devuelve PNG protegido, no una URL pública.

Respuestas: 200 éxito, 201 creación de usuario, 204 borrado, 400 validación, 401 falta token/credenciales inválidas, 403 permisos insuficientes, 404 inexistente, 409 correo duplicado, 413 archivo demasiado grande.

## Ejecutar

El lanzador `../Iniciar-Backend.cmd` usa PostgreSQL instalado. También puedes configurar `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (Base64 de 32 bytes aleatorios o más), `PORT` y ejecutar el JAR. La base debe existir; Flyway crea/actualiza las tablas al arrancar. V1 crea usuarios y V2 las fotos.

```powershell
.\mvnw.cmd verify
java -jar .\target\usuarios-api-2.0.0.jar
```

Para Docker consulta `../DOCKER.md`. El `compose.yaml` no publica el puerto de PostgreSQL en el host. El volumen conserva usuarios y archivos. `API_BIND=0.0.0.0` permite el acceso móvil en Wi-Fi privada; por defecto solo expone la API en loopback.

## Seguridad y alcance

- BCrypt costo 12, contraseñas mínimo 12 caracteres y máximo 72 bytes UTF-8.
- JWT HS256 de 15 minutos con emisor, audiencia y expiración; roles consultados de la base en cada petición.
- Registro público sin privilegios ADMIN; autorización en Spring Security.
- Consultas SQL parametrizadas, validación de entradas y errores sin secretos.
- Archivos pequeños protegidos, recodificados y vinculados con clave foránea. Borrado en cascada.
- Sesiones sin cookies; CSRF deshabilitado para este API con Bearer. Sin CORS abierto; el móvil nativo no necesita CORS.
- Para un servicio público faltan configuración HTTPS del despliegue, límites de peticiones/login, observabilidad, backups y gestión operacional de secretos.

Los recursos `static/` de la interfaz web anterior siguen disponibles, pero la app móvil no los usa. La arquitectura y la defensa están explicadas en `../ARQUITECTURA-Y-DEFENSA.md`.

Las pruebas por defecto usan H2 en modo PostgreSQL y vacían sus tablas. `-Ppostgres-test` usa PostgreSQL 17 en Testcontainers. No apuntes las pruebas a la base de trabajo.
