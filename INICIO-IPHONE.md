# Abrir la aplicación en tu iPhone desde Windows

## 1. Instalar lo necesario

Ya tienes Java y PostgreSQL. Instala **Node.js 24 LTS** desde https://nodejs.org y abre una nueva ventana PowerShell. Comprueba:

```powershell
node --version
npm.cmd --version
```

En el iPhone instala **Expo Go** desde App Store. Crea una cuenta Expo si no tienes una e inicia sesión. Es una herramienta para ejecutar el proyecto durante el desarrollo, no una página web.

## 2. Iniciar el backend actualizado

Detén la API anterior con Ctrl+C en su ventana si está ocupando el puerto 8080. No desinstales PostgreSQL ni borres la base.

Abre la carpeta de esta entrega, `entrega-mobile`, y ejecuta `Iniciar-Backend.cmd`. Escribe la contraseña de PostgreSQL cuando la pida. Mantén abierta la ventana y espera `Started UsuariosApplication`.

El lanzador usa `usuarios-api-2.0.0.jar`. La versión anterior no tiene los endpoints de subida de fotos.

Si no existe ninguna cuenta administradora, abre PowerShell en esta carpeta y ejecuta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Iniciar-Backend.ps1 -CrearAdministrador
```

Introduce un correo nuevo y una contraseña de 12 caracteres como mínimo. Si el administrador ya existe, el arranque no cambia su contraseña. La contraseña de PostgreSQL y la del administrador son diferentes.

Si tu puerto debe ser otro, usa `-Port 8082` y utiliza ese mismo puerto en la app.

## 3. Encontrar la dirección de la computadora

Conecta PC e iPhone a la misma red Wi-Fi privada. En otra ventana PowerShell:

```powershell
ipconfig
```

Busca **Dirección IPv4** en el adaptador Wi-Fi activo. Ejemplo: `192.168.1.20`. Tu dirección será probablemente otra.

En Safari del iPhone abre `http://TU-IP:8080/api/usuarios`. Una respuesta **401 / Autenticación requerida** confirma que el iPhone alcanza la API. Es esperada porque Safari no envió JWT.

Si no conecta, permite Java en redes privadas en Firewall de Windows; comprueba que no estás en Wi-Fi de invitados o una red que aísle dispositivos. No desactives todo el firewall. Si necesitas una regla explícita, abre PowerShell como administrador y limita el acceso a tu subred privada:

```powershell
New-NetFirewallRule -DisplayName 'Directorio API clase' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private -RemoteAddress LocalSubnet
```

Para retirarla después de la demostración:

```powershell
Remove-NetFirewallRule -DisplayName 'Directorio API clase'
```

## 4. Preparar y abrir la app

Abre PowerShell **dentro de `entrega-mobile/mobile`**. Ejecuta una línea cada vez:

```powershell
npm.cmd ci
npx.cmd expo login
npm.cmd start
```

Inicia sesión con **la misma cuenta Expo que usas en Expo Go del iPhone**. La versión actual de Expo Go para un dispositivo iOS físico exige esta coincidencia. Esta cuenta sirve para abrir el proyecto; es distinta de tu cuenta ADMIN/USER de la API.

Permite Node.js en redes privadas si Windows lo pregunta. Deja esta segunda terminal abierta. Usa la cámara del iPhone para escanear el QR que aparece y pulsa **Abrir en Expo Go**. Permite acceso a la red local cuando iOS lo pida.

Si Metro no conecta, revisa el puerto 8081 y los permisos de Node.js en la red privada. La primera descarga del proyecto puede tardar. Para reiniciar la caché:

```powershell
npx.cmd expo start --clear
```

## 5. Conectar con tu API

En la pantalla de inicio de la app, en **Conexión → Dirección del backend**, reemplaza la dirección por:

```text
http://TU-IP:8080
```

Ejemplo: `http://192.168.1.20:8080`. No agregues `/api` ni `/usuarios`. **No uses localhost en el iPhone**, porque apuntaría al propio teléfono. `10.0.2.2` solo corresponde al emulador Android.

Inicia sesión con el correo y la contraseña de la cuenta administradora que ya creaste en la API. No uses la cuenta Expo ni las credenciales de PostgreSQL.

## 6. Demostrar los requisitos

1. Como ADMIN, pulsa **Actualizar en paralelo**. Verás los tiempos de perfil, lista y total.
2. Crea un usuario con rol USER y contraseña de al menos 12 caracteres.
3. Abre **Ver / editar**: consulta por ID y cambia su nombre. Guarda.
4. Elimina solo ese usuario de prueba y observa la lista actualizada.
5. Abre **Mi perfil → Subir foto de perfil** y selecciona una foto. Cierra la sesión y vuelve a entrar: la foto sigue en PostgreSQL.
6. Registra/inicia una cuenta USER: ve su propio perfil, pero no tiene herramientas de administración. En Postman una petición de listado con ese token devuelve 403.
7. Presenta el Dockerfile y ejecuta la ruta de `DOCKER.md` en un equipo con Docker operativo. Ejecutar con Java directamente no demuestra la ejecución del contenedor.

Los JWT duran 15 minutos. Al vencer, la app vuelve al inicio de sesión. No hay refresh token. Si aparece 401 vuelve a autenticarte.

## Si surge un problema

| Síntoma | Revisión |
| --- | --- |
| `npm.ps1 cannot be loaded` | Usa `npm.cmd` / `npx.cmd` como en esta guía |
| El QR no abre | Actualiza Expo Go, misma cuenta Expo, misma Wi-Fi, permite Node.js en red privada |
| Abre la app, pero no inicia sesión | Prueba Safari contra la IP; revisa puerto, Java y cuenta de la API |
| La API devuelve 401 en Safari | Conexión correcta; falta el token, como se espera |
| Cuenta USER no ve CRUD | Es la autorización prevista; entra como ADMIN |
| Foto devuelve 404 o 403 inesperado | Confirma que ejecutas JAR 2.0.0 y la ruta `/api/usuarios/me/avatar` |
| `SDK incompatible` | Instala una versión Expo Go compatible con SDK 57; no cambies dependencias sueltas |
| iPhone no permite fotos/red local | Ajustes de iOS → Expo Go → habilita los permisos necesarios |

El modo `--tunnel` de Expo solo transporta el código móvil; no expone automáticamente la API de tu PC. Para clase, usa una red privada compartida o un backend HTTPS accesible.

## Entrega independiente de Expo Go

Si el profesor exige instalar un archivo firmado sin Expo Go, necesitas configurar una compilación iOS y la firma/distribución correspondiente de Apple. `mobile/eas.json` incluye un perfil `preview`; con la cuenta y dispositivos registrados se puede usar `npx eas-cli build --platform ios --profile preview`. Puede implicar membresía Apple Developer y límites/costos del servicio. No se ha solicitado ni ejecutado una compilación remota en esta entrega.

Fuentes: [Expo: iniciar el proyecto y acceso desde iPhone](https://docs.expo.dev/get-started/start-developing/), [entorno Expo](https://docs.expo.dev/get-started/set-up-your-environment/), [distribución interna](https://docs.expo.dev/build/internal-distribution/).

