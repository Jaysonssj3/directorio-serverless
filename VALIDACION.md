# Validación de la entrega móvil

Fecha: 27 de septiembre de 2026.

## Comprobaciones ejecutadas

| Verificación | Resultado |
| --- | --- |
| TypeScript estricto de vistas, repositorios, ViewModels y pruebas | Sin errores |
| Pruebas móviles en Node | 16 aprobadas |
| Exportación Metro/Hermes Android | Correcta |
| Exportación Metro/Hermes iOS | Correcta |
| Configuración pública Expo, permisos y plugins | Resuelta correctamente |
| `docker compose config --quiet` | Sintaxis válida; no verifica daemon ni construcción |
| Integración backend, H2 en modo PostgreSQL | 10 aprobadas |
| Mismas pruebas contra PostgreSQL 18.6 real y aislado | 10 aprobadas |
| Flyway V1 y V2 | Aplicadas correctamente |
| JAR 2.0.0 ejecutado por HTTP real contra PostgreSQL 18.6 | Correcto |
| Foto multipart válida y lectura protegida PNG | 200; `Cache-Control: no-store` |
| Archivo mayor de 2 MB, parser HTTP real | 413 |
| Cuatro subidas simultáneas al mismo usuario | Las cuatro respondieron 200 |
| GET avatar sin JWT | 401 |

Las pruebas móviles verifican Bearer, tratamiento distinto de 401/403, timeout, validación de URL, restauración/limpieza de sesión, ausencia de contraseña en almacenamiento, aislamiento de tokens por servidor, CRUD, respuestas antiguas descartadas, inicio concurrente de peticiones, fallo parcial y cancelación/error de foto.

Las pruebas de backend cubren BCrypt, JWT real y JWT inválidos, CRUD, validación, duplicados, autorización, usuario eliminado, subida/reemplazo de imágenes, archivos falsos, límites, aislamiento entre usuarios y eliminación de la foto en cascada.

## Método y límites

- Se utilizó una instancia PostgreSQL temporal en loopback y puerto independiente. No se usó la base original del estudiante. Las credenciales temporales no forman parte de la entrega.
- El entorno de ejecución presentó restricciones de resolución de rutas de Java al compilar. Para verificar se copió el mismo código a un directorio temporal y se incluyeron los fuentes principales junto con los tests en esa copia. Tras la compilación, Maven ejecutó las 10 pruebas y empaquetó el JAR. El proyecto entregado conserva la estructura Maven estándar, sin ese ajuste temporal.
- Flyway administrado por Spring Boot emite una advertencia de versión no probada para PostgreSQL 18.6. Las migraciones y pruebas de esta entrega sí pasaron contra esa versión. Docker usa PostgreSQL 17, cubierto por esa versión de Flyway. No se oculta la advertencia ni se afirma compatibilidad universal con PostgreSQL 18.
- Exportar iOS/Android comprueba transformación y generación del paquete JavaScript/Hermes, no una compilación nativa firmada.
- **Pendiente:** ejecución y revisión visual en el iPhone real con Expo Go, permisos iOS, galería y conectividad Wi-Fi.
- **Pendiente:** construir/ejecutar Docker en un equipo con daemon operativo. No se ha demostrado Docker Desktop funcionando en esta PC.
- No se ha generado ni distribuido IPA/APK. Se entrega código listo para Expo Go y configuración EAS para una eventual distribución firmada.

## Antes de presentar

### Corrección de subida en Expo Go

Se reprodujo con el serializador real de Expo 57 que el objeto `{uri, name, type}` de React Native provoca `Unsupported FormDataPart implementation`. Se sustituyó por `File` de `expo-file-system`, que proporciona los bytes del archivo. Dos pruebas comprueban el fallo anterior y la serialización corregida. También se distinguen errores de preparación del archivo y JSON inválido de los errores de conexión. TypeScript y las 16 pruebas pasan; la confirmación de galería/subida en el iPhone sigue pendiente.

- [ ] Abrir la app desde el QR en el iPhone.
- [ ] Login ADMIN, crear/consultar/editar/borrar usuario de prueba.
- [ ] Actualización concurrente con tiempos visibles.
- [ ] Seleccionar foto del iPhone, subirla, cerrar sesión y volver a verla.
- [ ] USER: perfil accesible; listado protegido devuelve 403.
- [ ] Sin JWT: 401.
- [ ] Mostrar contenedores funcionando y consumir la API del contenedor.
- [ ] Explicar MVVM y seguir una petición por puertos/adaptadores del backend.

No marques estas comprobaciones como realizadas hasta observarlas en tu dispositivo y entorno de presentación.
