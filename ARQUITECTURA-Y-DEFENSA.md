# Cómo entender y demostrar la aplicación

## Qué programa corre en cada lugar

```text
iPhone (React Native + TypeScript)
          │ HTTP + JSON / multipart + JWT
          ▼
PC (Spring Boot, puerto 8080)
          │ JDBC
          ▼
PostgreSQL (usuarios + usuario_avatar)
```

En desarrollo, Metro/Expo sirve el código móvil desde la PC, normalmente en el puerto 8081. La API escucha en 8080. PostgreSQL usa 5432 en tu instalación normal. Son tres tareas distintas. El teléfono nunca recibe la contraseña de PostgreSQL: solo conoce la dirección de la API y el JWT de su sesión.

Postman es otro cliente HTTP. Puede hacer las mismas peticiones de la app y sirve para comprobar respuestas y permisos. El backend sigue ejecutándose en Java, no dentro de Postman.

## React Native y TypeScript

React Native dibuja componentes nativos del teléfono. TypeScript añade tipos a JavaScript para detectar errores durante el desarrollo: por ejemplo, `role` solo acepta `ADMIN` o `USER`. Expo proporciona herramientas y módulos para ejecutar el proyecto, guardar secretos y seleccionar fotos.

`index.ts` registra `App`. `App.tsx` conecta las dependencias y decide si mostrar inicio de sesión o directorio según el estado. No hay WebView; la interfaz HTML anterior no es el cliente móvil.

## MVVM aplicado

```text
View ──acción──► ViewModel ──► Repository ──► ApiClient ──► API
  ▲                 │
  └── nuevo estado ─┘
```

| Capa | Archivos en `mobile/src` | Responsabilidad |
| --- | --- | --- |
| Model | `models/Usuario.ts` | Formas de los datos: Usuario, Role, Page, Session |
| View | `views/AuthScreen.tsx`, `DirectoryScreen.tsx`, `UserForm.tsx` | Dibujar datos, recoger entradas y comunicar acciones |
| ViewModel | `viewmodels/SessionViewModel.ts`, `UsuariosViewModel.ts` | Estado, carga, acciones, validaciones, errores, expiración |
| Repositorio | `data/UsuariosRepository.ts` | Operaciones de usuarios, login y archivo; traduce operaciones a endpoints |
| Infraestructura | `data/ApiClient.ts`, `SessionStore.ts`, `PhotoPicker.ts` | HTTP, SecureStore y acceso a galería/procesamiento |

`Observable` mantiene el estado y avisa a sus suscriptores. Las vistas usan `useSyncExternalStore` para redibujarse cuando cambia. Los ViewModels no importan componentes de React Native; reciben interfaces/dependencias, por lo que pueden probarse con repositorios falsos sin teléfono ni red. En la vista quedan campos temporales del formulario y navegación; el ViewModel decide y ejecuta la operación.

Ejemplo al guardar un nombre:

1. `UserForm` recoge nombre/correo y llama `vm.save(...)`.
2. `UsuariosViewModel` valida y activa `saving`.
3. `UsuariosRepository.update` envía PUT `/api/usuarios/{id}`.
4. `ApiClient` añade Authorization Bearer y procesa el resultado.
5. El ViewModel recarga la lista y cambia su estado. La vista muestra la lista actualizada o el error.

## JWT y autorización

1. POST `/api/auth/login` envía correo y contraseña.
2. El servidor compara la contraseña con el hash BCrypt y devuelve JWT firmado, tipo Bearer y duración de 900 segundos.
3. La app guarda token, vencimiento y servidor en SecureStore del dispositivo. No guarda la contraseña.
4. Cada petición protegida lleva `Authorization: Bearer <token>`.
5. El backend comprueba firma, emisor, audiencia y vencimiento; consulta al usuario para obtener su rol actual.
6. Un USER puede consultar su perfil y subir su foto. Un ADMIN administra usuarios. Ocultar botones mejora la experiencia; la protección real está en el servidor.
7. Al vencer o recibir 401, la app limpia la sesión. Un 403 informa permisos insuficientes sin cerrar la sesión.

JWT está firmado, no cifrado. No debe contener contraseñas ni secretos. BCrypt es un hash de contraseña, no un cifrado reversible. HTTP local se permite para clase; fuera de esa red se exige HTTPS. El secreto que firma JWT nunca se incorpora al móvil.

## Consumo concurrente

Abre `UsuariosViewModel.load`. Inicia `repo.me()` y `repo.list(page)` antes de esperar. Luego `Promise.allSettled` espera a ambas. Si una falla, el resultado de la otra se conserva y se informa del error.

En una carga secuencial, una consulta de 200 ms seguida de otra de 300 ms tarda aproximadamente 500 ms. Con consultas concurrentes, suele acercarse a 300 ms más gastos de red/procesamiento. Los tiempos reales pueden variar; la pantalla no inventa mejoras ni hace una comparación secuencial medida.

Como ADMIN, pulsa **Actualizar en paralelo**. Muestra los tiempos de cada petición y el total. Abre la prueba `starts profile and list concurrently`: comprueba que ambas funciones se invocan cuando ninguna respuesta ha terminado todavía. Una cuenta USER no consulta la lista de ADMIN, porque no tiene permiso.

## Subida de archivos

En esta entrega el archivo es una **foto de perfil**. No se implementan PDF ni documentos arbitrarios.

1. `PhotoPicker` abre la galería, pide permiso y permite elegir una imagen.
2. La reduce a un máximo de 640 px por lado y la convierte a JPEG, incluso si el original del iPhone era HEIC.
3. `UsuariosRepository.upload` crea `FormData` con el campo `archivo` y envía POST `/api/usuarios/me/avatar` con JWT.
4. El backend limita el tamaño a 2 MB, comprueba el contenido real PNG/JPEG, limita dimensiones/píxeles y recodifica PNG sin metadatos.
5. `JdbcAvatarRepository` guarda bytes en la tabla `usuario_avatar` con clave foránea al usuario. Reemplaza la foto anterior en una transacción; un bloqueo del propietario serializa subidas concurrentes.
6. GET del avatar requiere JWT y devuelve `image/png` con `Cache-Control: no-store`. La app lo muestra con `Image` y el encabezado de autorización.
7. Al borrar al usuario, la clave foránea elimina su foto.

Guardar imágenes pequeñas en PostgreSQL simplifica esta práctica y permite persistirlas junto a los usuarios. Para muchos archivos o archivos grandes convendría almacenamiento de objetos y guardar solo metadatos/referencias en la base.

## Arquitectura hexagonal del backend

```text
HTTP / Controllers → puertos de entrada → servicios de aplicación → puertos de salida
                                                │                       ▲
                                             dominio                    │
                                                          JDBC / BCrypt / JWT / ImageIO
```

Abre `backend/src/main/java/com/ejemplo/usuarios`:

- `domain`: Usuario, Role, Avatar y errores. No contiene Spring ni SQL.
- `application/port/in`: UsuariosUseCase, AuthenticationUseCase, AvatarUseCase.
- `application/service`: casos de uso, dependientes de interfaces.
- `application/port/out`: UsuarioRepository, AvatarRepository, PasswordHasher, TokenIssuer, ImageSanitizer.
- `adapter/in/web`: controladores y DTO de HTTP.
- `adapter/out`: PostgreSQL mediante JDBC, BCrypt, JWT y procesamiento de imágenes.
- `configuration`: Spring crea los objetos y conecta los puertos con sus adaptadores.

La evidencia no es solo la estructura de carpetas: `AvatarService` no sabe qué es `MultipartFile`, `JdbcTemplate` o `ImageIO`. Recibe bytes y depende de `ImageSanitizer` y `AvatarRepository`. Puedes sustituir la tecnología de almacenamiento sin cambiar ese caso de uso. `AvatarController` sí conoce HTTP; `JdbcAvatarRepository` sí conoce SQL. MVVM organiza el móvil; hexagonal organiza el backend.

## Guion para la corrección

1. Arranca backend y móvil. Explica los tres procesos y sus puertos.
2. Muestra login y las diferencias entre ADMIN y USER.
3. Crea, consulta, edita y elimina un usuario de prueba.
4. Carga perfil/lista en paralelo y abre el método y su prueba.
5. Sube una foto. Vuelve a iniciar sesión para comprobar persistencia.
6. En Postman demuestra 401 sin token, 403 con USER y 200 con ADMIN.
7. Muestra las capas MVVM y sigue una acción de la vista hasta la API.
8. Muestra puertos/adaptadores de la API, migraciones y Docker en ejecución.

Frase de explicación: «La vista recibe la interacción; el ViewModel actualiza el estado y llama al repositorio. El repositorio consume la API con JWT. El servidor aplica permisos y reglas, y persiste mediante un adaptador de PostgreSQL».

Para explicar decisiones con confianza, modifica un campo o un mensaje, ejecuta las pruebas y repite ese recorrido en el código. No hace falta memorizar todo: debes poder seguir cómo viaja una petición y dónde se valida.
