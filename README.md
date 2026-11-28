# Mesa de partes · Manuel Scorza Torre

Versión 8.0.0 · Portal público y atención por áreas.

Esta actualización conserva la configuración de tu proyecto: Firebase Authentication y Firestore para accesos y expedientes, Supabase Storage privado para archivos y GitHub Pages para publicar la página. No utiliza Firebase Storage ni Cloudflare R2. No se han modificado tus cuentas ni tu página publicada desde esta entrega.

## Qué incluye

- Portal con identidad institucional, fotografía real de la sede, orientación, contactos y diseño adaptable.
- Presentación sin cuenta de ciudadano, en tres pasos: datos, documento y confirmación.
- Nombres, ambos apellidos, DNI, celular, correo y domicilio obligatorios. Valida el formato; no comprueba la identidad contra RENIEC ni verifica la titularidad del teléfono o correo.
- Documento principal obligatorio en PDF, JPG o PNG, hasta 10 MB. Para varias páginas, adjunta un solo PDF.
- Número de expediente y número interno automáticos, cargo imprimible y clave personal de seguimiento.
- Doce áreas de destino, bandeja con búsqueda, filtros, paginación y exportación CSV.
- Cuentas individuales del personal, asignación de área y activación/desactivación por administración.
- Respuestas de texto y documentos descargables, estado, derivaciones, historial y notas internas.
- Datos de contacto separados del seguimiento público. El DNI, celular, correo, domicilio y las notas internas no aparecen en esa consulta.

## 1. Abrir en Visual Studio Code

1. Conserva una copia de tu carpeta anterior y extrae este ZIP en una carpeta nueva.
2. En Visual Studio Code elige **Archivo → Abrir carpeta**. Abre la carpeta que contiene `package.json`, `docs`, `supabase` y `firestore.rules`.
3. Abre **Terminal → Nueva terminal** y ejecuta:

```powershell
node --version
npm.cmd run check
npm.cmd start
```

Usa Node.js 22 o superior. Abre **http://127.0.0.1:8787** en Chrome o Edge. También puedes pulsar F5 en Visual Studio Code; la configuración incluida abre el navegador externo. Mantén la terminal abierta mientras revisas localmente. La página publicada en GitHub no depende de esa terminal.

`npm.cmd start` y `npm.cmd run check` funcionan sin instalar dependencias: el SDK de Firebase ya está incluido en `docs/vendor`. No necesitas ejecutar un BAT, cambiar la política de PowerShell ni usar Python. Para desarrollo, reconstrucción del SDK o pruebas del emulador sí se usa `npm.cmd ci`.

## 2. Actualizar Firebase

Haz los pasos 2, 3 y 4 en la misma sesión de actualización: el portal anterior no es compatible con las nuevas reglas de registro.

1. Entra en https://console.firebase.google.com/ y abre **mesa-de-partes-53521**.
2. Ve a **Firestore Database → base (default) → Reglas**.
3. Reemplaza todo el editor con el contenido de **firestore.rules de esta versión** y pulsa **Publicar**.
4. En **Authentication → Sign-in method**, verifica que **Correo electrónico/contraseña** esté habilitado.
5. Conserva la cuenta administrativa existente y el documento `admins` identificado con su UID. No borres expedientes ni reinicies `config/counter`.

En la web puedes seguir ingresando con **joel** y la contraseña que ya tenga esa cuenta en Firebase. Este ZIP no contiene ni restablece contraseñas.

Si todavía no existe el administrador, crea su cuenta desde **Authentication → Users → Add user**, con el correo `joel@mesa-de-partes-53521.firebaseapp.com` y una contraseña privada. Copia su UID real; en Firestore crea un documento con ese UID dentro de `admins`, con `role` de tipo string y valor `admin`, y `active` de tipo boolean y valor `true`. No escribas literalmente «UID» como nombre de documento. Si la cuenta ya existe, reutiliza su UID.

En **Authentication → Settings → Authorized domains**, comprueba `joetorresmind-a11y.github.io`. Para otro dominio, registra el dominio que realmente vayas a utilizar.

## 3. Actualizar Supabase sin crear otro proyecto

Tu archivo `docs/supabase-config.js` conserva esta función:

```text
https://sbkpcuuyfsmrdqxamtte.supabase.co/functions/v1/adjuntos
```

No repitas la creación del proyecto si este es el que ya configuraste. En ese proyecto, **Storage** debe mostrar el bucket **mesa-partes-adjuntos**, privado, con límite de 10 MB y tipos `application/pdf`, `image/jpeg`, `image/png`.

Si falta el bucket, abre **SQL Editor**, copia `supabase/bucket.sql` y pulsa **Run**. El SQL configura el depósito, no borra sus archivos. No habilites el acceso público ni políticas generales de lectura/escritura para `anon`. Revisa las políticas antiguas si reutilizas el proyecto.

Desde la raíz del proyecto, en la terminal de Visual Studio Code:

```powershell
npx.cmd --yes supabase@3.4.0 login
npm.cmd run publicar:supabase
```

Si ya tienes una sesión de Supabase CLI válida, puedes omitir el primer comando. Autoriza el acceso mediante el navegador y tu terminal. No copies tokens ni claves privadas a GitHub o al chat.

Cuando la CLI pregunte si deseas desplegar `adjuntos`, verifica el proyecto y elige **Yes**. Espera el mensaje **Deployed Functions** y **Función publicada**. El asistente usa la opción actual `--remote` y el empaquetado remoto `--use-api`, sin necesitar Docker para ese despliegue. Tampoco utiliza `shell: true`.

Debes desplegar la nueva función aunque la versión anterior ya estuviera publicada: ahora comprueba el acceso de Firebase para los adjuntos de respuesta. Los cuatro archivos de `supabase/functions/adjuntos` forman una sola función.

`verify_jwt = false` en Supabase es intencional: el público presenta sin cuenta Supabase; los documentos de respuesta se autorizan con el token de Firebase y las reglas de Firestore dentro de la función. No añadas una clave secreta de Supabase a la web. Las claves privilegiadas se usan únicamente en el entorno servidor de Edge Functions.

Los orígenes configurados son:

```text
https://joetorresmind-a11y.github.io
http://127.0.0.1:8787
http://localhost:8787
```

Para otro origen, configura **ALLOWED_ORIGINS** en los secretos de Edge Functions, separado por comas, sin rutas ni barra final. Los puertos 5500 o 5502 de Live Server no están autorizados por defecto; utiliza `npm.cmd start` para la revisión local.

Solo si cambias de proyecto Supabase, ejecuta `npm.cmd run configurar:supabase`. Pega su **Project URL**, sin `/rest/v1/`, claves ni otras rutas.

## 4. Conservar el seguimiento de expedientes anteriores

1. Abre la versión nueva localmente e ingresa en **Acceso institucional**.
2. En la barra lateral selecciona **Administración**.
3. Pulsa **Comprobar servicios** para revisar Firestore y el depósito privado.
4. Pulsa **Preparar seguimiento de expedientes** y espera la cantidad procesada.

Este paso crea las vistas de consulta `seguimiento` para los documentos antiguos. Conserva sus números y claves; no publica DNI, contactos, domicilio, descripción privada, historial ni notas internas. Puedes repetirlo si hubo una interrupción. Los nuevos registros ya crean esa vista automáticamente.

Las fichas antiguas mostrarán «Sin dato» en los campos que no existían. La actualización no inventa esos datos.

Los archivos antiguos de R2 o Firebase Storage no se copian automáticamente a Supabase. Esta herramienta prepara el seguimiento, no migra archivos entre proveedores. Si hay archivos anteriores, conserva el servicio y una copia de respaldo hasta completar una migración técnica y verificar las descargas. Los archivos que ya están en Supabase conservan su ruta.

## 5. Crear cuentas para cada área

Como administrador, abre **Cuentas por área**:

1. Escribe el nombre de la persona y un correo de acceso válido que controle.
2. Elige el área que atenderá.
3. Define una contraseña inicial de al menos 12 caracteres y pulsa **Crear / vincular cuenta**.
4. Comparte los datos de acceso directamente con esa persona, por un canal privado.
5. Pídele ingresar con su correo y cambiar la contraseña desde **Mi cuenta**.

No se crean cuentas ficticias ni se guardan contraseñas en Firestore. El alta utiliza una sesión secundaria en memoria para conservar tu sesión de administrador.

Si Firebase indica que el correo ya existe, entra a **Authentication → Users**, copia su UID, abre **Vincular una cuenta que ya existe en Firebase**, pega el UID y deja la contraseña vacía. Verifica que UID y correo correspondan a la misma persona. Una cuenta con perfil ya asignado se modifica desde la lista de personal, no repitiendo la vinculación.

En **Personal autorizado** puedes cambiar el área con **Guardar área** o **Desactivar** el acceso. Desactivar el perfil bloquea nuevas consultas y operaciones, incluso si la persona conserva una sesión de Firebase abierta. No borra su cuenta de acceso ni sus respuestas anteriores.

| Perfil           | Alcance                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Público          | Presenta documentos y consulta un expediente con su clave completa                                      |
| Personal de área | Lee datos, adjuntos y notas de expedientes actualmente asignados a su área; responde y actualiza estado |
| Administrador    | Ve todos los expedientes, deriva entre áreas, responde y administra las cuentas del personal            |

Solo la administración deriva a otra área. Al hacerlo, el área anterior pierde acceso al expediente y la nueva recibe acceso al expediente completo y su historial. Una misma área puede tener varias cuentas personales.

## 6. Responder y entregar documentos

1. El personal ingresa en **Acceso institucional → Mi bandeja**.
2. Busca el expediente y pulsa **Abrir**.
3. En **Responder**, escribe el mensaje, adjunta opcionalmente un PDF/JPG/PNG de hasta 10 MB y elige el estado.
4. Pulsa **Publicar respuesta**. Debe haber texto o archivo; se pueden incluir ambos.
5. El solicitante abre **Consultar trámite**, pega la clave del cargo y ve **Respuestas y documentos**. Desde ahí descarga el archivo.

Las respuestas se agregan al historial; no reemplazan las anteriores. Esta edición admite hasta 40 respuestas por expediente. Las notas de **Estado / nota** o **Derivar / estado** son internas y no aparecen en la consulta pública. No pegues información privada innecesaria en una respuesta pública al solicitante.

No hay correo ni WhatsApp automáticos. El sistema recoge esos datos de contacto y publica las respuestas en la consulta. El personal puede contactar al solicitante por los canales institucionales que tenga disponibles.

## 7. Publicar la actualización en GitHub Pages

1. Reemplaza el contenido de tu repositorio `mesa-de-partes` con los archivos de esta versión. `index.html`, `docs`, `package.json`, `.github` y `.nojekyll` deben quedar en la raíz.
2. Sube el contenido, no el ZIP ni una segunda carpeta envolvente. Conserva `docs/vendor/firebase-runtime.js` y su licencia.
3. Si ya usas **Settings → Pages → Source → GitHub Actions**, conserva ese método. El flujo incluido comprueba el proyecto y publica `docs/`.
4. Si usas publicación desde rama, selecciona **Deploy from a branch → main → /(root)**. El `index.html` de raíz abre `docs/` y conserva la navegación.
5. Espera a que termine el despliegue y recarga con **Ctrl+F5**.

Página prevista: https://joetorresmind-a11y.github.io/mesa-de-partes/

No subas `node_modules`, `.env`, archivos de cuentas de servicio, tokens, `supabase/.temp` ni documentos reales. Retira los antiguos `docs/r2-config.js`, `cloudflare` y `storage.rules` si aún los conservas: esta versión no los utiliza.

## 8. Prueba después de activar los servicios

Utiliza un documento sin información sensible para esta prueba:

1. Presenta una solicitud con todos los datos obligatorios y un archivo pequeño. Guarda el cargo y la clave.
2. Comprueba que el número es automático y que la siguiente solicitud recibe otro número.
3. Ingresa con una cuenta del área elegida. Debe ver y abrir ese expediente.
4. Ingresa con una cuenta de otra área. No debe verlo en la bandeja ni abrir su dirección de detalle.
5. Responde desde el área correcta con texto y un archivo. Verifica la descarga con la clave desde una ventana privada, sin sesión institucional.
6. Deriva desde administración y comprueba que cambia el acceso entre áreas.
7. Desactiva una cuenta de prueba y verifica que ya no puede consultar ni responder.
8. Repite el registro y la descarga desde GitHub Pages, no solo desde localhost.

## Problemas frecuentes

| Mensaje o situación                               | Acción                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Firebase rechazó la operación / no tienes permiso | Publica todo `firestore.rules` de v8 y verifica el perfil activo y el área                  |
| Clave antigua no encontrada                       | Ejecuta **Preparar seguimiento de expedientes** con el administrador                        |
| Respuestas o descargas del personal rechazadas    | Despliega la nueva función `adjuntos` y comprueba las reglas y la cuenta                    |
| Falta Authorization / Invalid JWT                 | Publica mediante el asistente incluido; la función utiliza Firebase, no sesiones Supabase   |
| Origen no autorizado                              | Revisa `ALLOWED_ORIGINS`, incluido el puerto. Usa `npm.cmd start`                           |
| Servicios de archivos no responden                | Comprueba que Supabase esté activo, el bucket sea privado y revisa Logs de `adjuntos`       |
| Failed to fetch dynamically imported module       | Sube `docs/vendor` y toda la nueva carpeta `docs`; recarga con Ctrl+F5                      |
| npm.ps1 bloqueado                                 | Ejecuta `npm.cmd` y `npx.cmd` en PowerShell                                                 |
| Missing script                                    | Estás en otra carpeta o mezclaste versiones. Abre la carpeta con package.json versión 8.0.0 |
| Aparece el README en GitHub                       | Revisa el `index.html` de raíz, `docs/`, `.nojekyll` y la fuente de publicación de Pages    |
| Otra persona actualizó el expediente              | Recarga el detalle y revisa la información antes de repetir la operación                    |

## Desarrollo y seguridad

Los archivos son editables en Visual Studio Code:

- `docs/app.js`: vistas y navegación.
- `docs/app.css`: diseño adaptable e impresión.
- `docs/domain.js`: campos, áreas y validación.
- `docs/data.js`: registro, consultas, cuentas y respuestas.
- `firestore.rules`: autorización y validación real en la base de datos.
- `supabase/functions/adjuntos/`: validación y autorización de archivos privados.
- `scripts/`: servidor local, configuración, despliegue y construcción del SDK.
- `tests/` y `validation/`: pruebas de aplicación y reglas.

Para cambiar áreas, mantén sincronizadas las listas de `docs/domain.js` y `firestore.rules`, actualiza los perfiles o expedientes afectados y vuelve a publicar las reglas. Cambiar solo las opciones visuales no modifica los permisos del servidor.

Para reconstruir el SDK local o ejecutar la suite de reglas:

```powershell
npm.cmd ci
npm.cmd run build:firebase
npm.cmd run check
npm.cmd run test:rules
```

La prueba de reglas requiere Java 21 o superior y usa un emulador local con un proyecto de demostración; no escribe en tus datos reales. El uso normal del portal no necesita Java ni instalar estas dependencias.

La clave de seguimiento es una credencial de consulta de 128 bits: quien la reciba puede ver ese trámite y descargar sus archivos, aun sin ser personal. No la publiques ni la incluyas en enlaces abiertos. La autorización del área se comprueba en Firestore y en la función de respuestas, no solo en la pantalla.

Firebase permite el alta de usuarios de correo/contraseña mediante su API cliente; una cuenta de Authentication sin perfil autorizado no obtiene acceso a expedientes. Los perfiles `staff` solo los puede asignar un administrador. Para convertir el alta de Authentication en una operación exclusivamente de servidor se necesitaría otro servicio de provisión con Firebase Admin.

El sistema no incluye comprobación de identidad, firma digital certificada, antivirus, notificaciones automáticas, borrado automático ni una certificación de cumplimiento normativo. La firma inicial del archivo y el tamaño se validan, pero eso no sustituye un antivirus. CORS limita los orígenes del navegador y no sustituye un límite de solicitudes: antes de una apertura institucional de gran alcance conviene añadir control de abuso y supervisión de consumo.

Una carga seguida de un fallo de registro puede dejar un archivo sin expediente. El mismo intento se puede reintentar sin duplicar el correlativo ni sobrescribir otro archivo; no se eliminan archivos automáticamente cuando el resultado de una escritura es incierto. La institución debe definir respaldos, conservación y atención de solicitudes sobre datos personales.

## Identidad institucional y fuentes

El pie utiliza los contactos publicados por el instituto: Av. Universitaria N.° 258, Barrio Cocharcas, Acobamba; teléfono 964 159 700; horario publicado de 8:00 a. m. a 4:00 p. m. No se inventó un correo institucional.

La reseña institucional cita la R. M. N.° 448-89-ED, del 12 de julio de 1989. Se incluye un enlace al Ministerio de Educación como referencia institucional; no se presenta este software como avalado o certificado por el Ministerio.

Fuentes consultadas el 27 de noviembre de 2026:

- https://iestmst.edu.pe/contacts/
- https://iestmst.edu.pe/presentacion/
- https://www.gob.pe/minedu
- https://firebase.google.com/docs/firestore/use-rest-api
- https://firebase.google.com/docs/firestore/security/rules-query
- https://firebase.google.com/docs/auth/web/password-auth
- https://supabase.com/docs/reference/cli/supabase-functions-deploy
- https://supabase.com/docs/guides/functions/secrets

Consulta `VERIFICACION.md` para conocer exactamente qué se probó y qué queda por comprobar en tus servicios.
