# Validación serverless

## Verificado localmente

- Java: 14 pruebas aprobadas con H2, incluidas las 10 existentes, tres de DATABASE_URL y una del adaptador Lambda.
- Las mismas 14 pruebas también pasaron contra PostgreSQL 18.6 real en una instancia temporal aislada, incluido multipart por el handler. No se utilizó la base local del usuario. Flyway conserva su advertencia de compatibilidad no certificada con PostgreSQL 18; el runner utiliza PostgreSQL 17.
- `LambdaProxyTest` invoca el handler con eventos API Gateway HTTP v2: registro, login, 401/403, perfil, consulta/edición/borrado y multipart Base64. Comprueba que la respuesta de imagen también sea Base64 y contenga PNG válido.
- Construcción `-Plambda verify`: genera ZIP con clases/recursos en raíz y dependencias en `lib/`, como requiere Java Lambda. El JAR Spring Boot con BOOT-INF no se utiliza como paquete Lambda.
- TypeScript y 16 pruebas móviles aprobados tras admitir URL cloud por `EXPO_PUBLIC_API_URL` y ampliar el tiempo de espera a 35 segundos.
- Terraform 1.16.5, proveedor AWS 6.67.0: configuración válida (`terraform validate`) y prueba de plan con proveedor simulado (`terraform test`, 1 aprobada).
- YAML del workflow analizado; scripts Python comprobados sintácticamente.

## Limitaciones y método

El plan de `terraform test` utiliza un proveedor simulado: **no es un plan contra AWS y no crea recursos**. No se ejecutó Apply, no hay URL pública operativa y no existe aún una ejecución real de GitHub Actions. Faltan las cuentas/configuración descritas en la guía.

La compilación Java se verificó con la misma copia de fuentes en un directorio temporal por restricciones de resolución de rutas del entorno Windows. Los fuentes principales se incluyeron junto con los tests solo en esa copia temporal; la estructura entregada y el workflow Linux mantienen Maven estándar.

El instalador Terraform tuvo errores locales de permisos al manejar archivos temporales. Se descargó el proveedor oficial, se verificó su SHA-256 y se instaló localmente para validar. El lock conserva los checksums oficiales de ZIP para las plataformas, incluido Linux del runner. No se desactivaron las comprobaciones de integridad.

Git está inicializado en `main`, pero la protección del directorio `.git` impidió escribir commits desde este entorno. La guía incluye los comandos para crearlos desde PowerShell. No se presentan hashes ni commits inexistentes.

## Pendiente de confirmar en la nube

1. Conexión y migraciones contra la base Neon elegida.
2. Terraform Init/Plan/Apply en AWS real y permisos IAM de la cuenta.
3. Build y pruebas en el runner GitHub Actions.
4. Cold start, JWT, CRUD y subida/lectura de imagen a través del API Gateway desplegado.
5. Login y operaciones desde el iPhone con la URL HTTPS real.
6. Grabación del video y registro de evidencia.

La ausencia de credenciales/cuentas no se sustituye con resultados simulados. La prueba smoke del workflow debe pasar para considerar terminado el despliegue.
