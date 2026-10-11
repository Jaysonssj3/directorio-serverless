# Nueva actividad: notificaciones por correo

Consulta [NOTIFICACIONES-PASO-A-PASO.md](NOTIFICACIONES-PASO-A-PASO.md) para desplegar SNS, SQS, notification-lambda y SES, verificar el remitente y probar la pantalla móvil. [Validación local](NOTIFICACIONES-VALIDACION.md).

# Despliegue serverless AWS

La nueva entrega está en **SERVERLESS-PASO-A-PASO.md**. Incluye `terraform/`, `.github/workflows/deploy.yml`, adaptador Lambda, pruebas y guía de video. El despliegue real espera configuración de GitHub, AWS y Neon; consulta **SERVERLESS-VALIDACION.md** para distinguir las verificaciones locales de la evidencia cloud pendiente.

- Guía de puesta en marcha: `SERVERLESS-PASO-A-PASO.md`.
- Video de 8–12 minutos: `GUION-VIDEO-SERVERLESS.md`.
- Registro de evidencia: `EVIDENCIA-SERVERLESS.md`.
- Construir Lambda: en `backend`, `mvn -Plambda verify`.

```text
Mobile → API Gateway HTTPS → Lambda Java 21 → Neon PostgreSQL
GitHub main → Actions → pruebas + ZIP → Terraform Apply → AWS
```

A continuación se conserva la documentación de la ejecución local.

# Directorio móvil · React Native + TypeScript

Aplicación nativa iOS/Android que consume la API Spring Boot de usuarios. Usa MVVM, JWT, CRUD, consultas concurrentes y subida de fotos. El backend conserva su arquitectura hexagonal y añade una migración para almacenar imágenes en PostgreSQL.

## Empieza por aquí, en iPhone

Para presentar con datos móviles, lee primero **CLASE-MANANA.md**. Para la instalación general, lee **INICIO-IPHONE.md**. Usa Windows para iniciar la API y el servidor de desarrollo; abre la app en tu iPhone con **Expo Go**. La app no es la pantalla HTML del proyecto anterior: sus vistas usan componentes nativos `View`, `Text`, `FlatList`, `TextInput`, `Image` y `Modal`.

## Contenido

| Archivo o carpeta | Para qué sirve |
| --- | --- |
| `mobile/` | Código React Native + TypeScript, configuración Expo y pruebas |
| `backend/` | API Java, migraciones V1/V2, Dockerfile, Compose y pruebas |
| `usuarios-api-2.0.0.jar` | Backend compilado con los nuevos endpoints de fotos |
| `Iniciar-Backend.cmd` / `.ps1` | Arranque con tu PostgreSQL instalado en Windows |
| `Iniciar-Mobile.cmd` | Inicia Expo después de la configuración inicial |
| `INICIO-IPHONE.md` | Instalación y conexión paso a paso |
| `DOCKER.md` | Construir y ejecutar backend + PostgreSQL en contenedores |
| `ARQUITECTURA-Y-DEFENSA.md` | Explicación del código y recorrido para la corrección en clase |
| `postman/` | Colección de pruebas de la API, incluida subida de archivos |
| `VALIDACION.md` | Qué se verificó y qué falta probar en el dispositivo |

## Requisitos y permisos

- Windows con Java 21 o superior compatible y PostgreSQL para el arranque local. El código Java se compila con objetivo 21.
- Node.js 24 LTS con npm; dependencias fijadas en `mobile/package-lock.json`. Expo SDK 57, React Native 0.86.3 y React 19.2.3.
- iPhone compatible con la versión vigente de Expo Go, misma red Wi-Fi que la PC y sesión en la misma cuenta Expo en teléfono/CLI.
- Una cuenta ADMIN de tu API para demostrar CRUD. El registro público siempre crea USER.
- Para Docker: Docker Engine operativo. Instalar WSL por sí solo no garantiza esto.

El proyecto anterior permanece separado. Al iniciar este JAR sobre tu base `usuarios`, Flyway conserva los usuarios y añade `usuario_avatar`. Haz una copia de seguridad antes de aplicar cambios a datos que quieras conservar. El nuevo lanzador genera un secreto JWT propio: inicia sesión otra vez; tus contraseñas de cuentas no cambian.

## Comprobaciones reproducibles

Desde `mobile`:

```powershell
npm ci
npm run typecheck
npm test
npm run export:ios
npm run export:android
```

Desde `backend`:

```powershell
.\mvnw.cmd verify
```

Con Docker operativo, las mismas pruebas contra PostgreSQL 17:

```powershell
.\mvnw.cmd -Ppostgres-test verify
```

La exportación de Expo genera JavaScript/Hermes para la plataforma: **no produce un IPA/APK ni equivale a probar un teléfono**. Para esta entrega se utiliza Expo Go; una distribución iOS independiente requiere firma y configuración Apple. No se incluye una cuenta Apple ni credenciales de firma.

