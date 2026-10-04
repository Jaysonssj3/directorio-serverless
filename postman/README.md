# Pruebas de la API en Postman

1. Importa `Directorio-Mobile.postman_collection.json`.
2. En variables de la colección, usa `baseUrl=http://localhost:8080` si Postman está en la PC del backend.
3. Asigna localmente `adminEmail` y `adminPassword` de una cuenta ADMIN existente. No publiques/compartas esos valores ni exportes tokens.
4. Ejecuta las peticiones en orden con Send. El login guarda el JWT automáticamente en una variable local de colección.
5. La creación genera un correo de prueba y guarda su ID para consulta, actualización y borrado.
6. En **11 · Subir foto propia**, abre Body → form-data y selecciona un archivo PNG/JPEG en `archivo`. Postman define el boundary; no añadas Content-Type manualmente.
7. El paso 13 elimina el usuario de prueba, incluida su foto. No sustituyas `createdUserId` por el ID de tu administrador.

La colección requiere elegir el archivo manualmente; no ejecutes todos los pasos con Runner sin configurar primero esa entrada. Las contraseñas de las cuentas de prueba no son credenciales de producción. Los JWT expiran a los 15 minutos; repite login si recibes 401.

Casos adicionales: envía texto renombrado `.png` (400), archivo de más de 2 MB (413), correo duplicado (409), o elimina Authorization (401). Usa el token USER para la lista de usuarios (403).
