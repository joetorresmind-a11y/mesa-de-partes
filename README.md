# Mesa de partes digital · Manuel Scorza Torre

Portal del IESTP Manuel Scorza Torre, Acobamba, Huancavelica. Edición para GitHub Pages y Firebase: acceso público sin registro, administrador en la esquina superior derecha, doce áreas de destino, numeración automática, cargo imprimible, consulta con clave y derivación de expedientes.

## Publicar en GitHub Pages (método sencillo)

1. Extrae el ZIP. Sube a tu repositorio **el contenido**, no el ZIP ni una carpeta envolvente. En la raíz deben verse `index.html`, `docs`, `README.md` y `firebase.json`.
2. En GitHub, abre **Settings → Pages → Build and deployment**.
3. Elige **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)** y pulsa **Save**.
4. Espera a que termine la publicación de GitHub Pages y abre la dirección que aparece en esa sección. Actualiza con Ctrl+F5 si conservas la versión anterior.

El archivo `index.html` de la raíz lleva automáticamente al portal de `docs/`, conservando la ruta del trámite. Así no se muestra el README como página de inicio. También puedes seleccionar `main → /docs`; esa carpeta contiene el portal completo.

### Si prefieres GitHub Actions

Incluye `.github/workflows/pages.yml`, elige **Settings → Pages → Source → GitHub Actions** y ejecuta **Actions → Publicar mesa de partes → Run workflow** sobre `main`. El flujo publica solamente `docs/`. Usa un único método de publicación. No cambies de método si el actual ya funciona.

GitHub aloja la interfaz; Firebase almacena y controla los datos. Una vez publicado no necesitas mantener Node.js ni tu computadora encendidos. No subas expedientes ni claves privadas al repositorio.

### Si se muestra el README

Es señal de que Pages está mostrando la raíz sin encontrar un `index.html` de entrada. Sube el `index.html` de esta edición a la raíz, junto a `README.md`, manteniendo la carpeta `docs/`. También puedes corregirlo seleccionando `/docs` como carpeta de publicación. No borres tus datos de Firebase.

## Activar Firebase una sola vez

La configuración pública del proyecto `mesa-de-partes-53521` ya está en `docs/firebase-config.js`. Eso no activa los servicios ni crea al administrador.

1. Abre https://console.firebase.google.com/project/mesa-de-partes-53521.
2. Activa **Authentication → Email/Password**. Crea la cuenta `joel@mesa-de-partes-53521.firebaseapp.com` con tu contraseña. La página acepta el usuario `joel`; la contraseña no está incluida en el repositorio.
3. Copia el UID de esa cuenta. En **Firestore Database**, usa la base `(default)` y crea `admins`, con un documento cuyo ID sea ese UID. Agrega `role` de tipo string con valor `admin`.
4. En **Firestore Database → Rules**, publica el contenido completo de `firestore.rules` de esta edición. No mezcles reglas antiguas: esta versión añade una vinculación privada para el correlativo y separa las notas internas.
5. Activa **Storage** si vas a recibir adjuntos. Comprueba el bucket `mesa-de-partes-53521.firebasestorage.app` y publica `storage.rules`. Autoriza la vinculación Storage/Firestore si Firebase la solicita. Revisa el plan y la facturación que Firebase muestre para habilitar Storage. El registro sin adjunto no utiliza Storage.
6. En **Authentication → Settings → Authorized domains**, agrega el dominio de tu GitHub Pages, sin `https://` ni el nombre del repositorio. Agrega también tu dominio personalizado si lo utilizas. Para pruebas locales, autoriza `localhost` y `127.0.0.1`.
7. Prueba un registro sin adjunto, copia su clave, consulta desde una ventana privada, inicia sesión como administrador y registra una derivación. Prueba luego un PDF pequeño.

También puedes publicar solamente las reglas desde la raíz del proyecto:

```powershell
npm.cmd install -g firebase-tools
firebase.cmd login
firebase.cmd deploy --only firestore:rules,storage
```

Ese comando no publica en GitHub. La actualización de la interfaz se realiza al subir los archivos al repositorio.

## Trabajar en Visual Studio Code

Para ver la página localmente, abre esta carpeta y usa F5 o:

```powershell
npm.cmd start
```

Abre http://127.0.0.1:8787. El servidor incluido solo entrega archivos estáticos; los registros se guardan en Firebase. También funciona con Live Server. Usa HTTP/HTTPS: abrir `index.html` con doble clic mediante `file://` bloquea los módulos del navegador.

Para comprobar sintaxis y ejecutar las pruebas sin instalar dependencias:

```powershell
npm.cmd run check
```

Se requiere Node.js 22 o superior para estas herramientas de desarrollo. No se necesita Node.js para visitar el sitio publicado.

## Dónde editar

| Archivo | Contenido |
|---|---|
| `docs/index.html` | Cabecera, navegación y pie institucional |
| `docs/app.css` | Diseño, colores y adaptación a pantallas pequeñas |
| `docs/app.js` | Formularios, Firebase, consulta y administración |
| `docs/firebase-config.js` | Configuración web pública y correo administrativo |
| `docs/sede.webp`, `docs/instituto.png` | Fotografía y logotipo institucional |
| `firestore.rules`, `storage.rules` | Reglas para publicar en Firebase |
| `.github/workflows/pages.yml` | Publicación automática de `docs/` |
| `tests/` | Pruebas locales de flujos y estructura |

## Datos y permisos

- El público puede crear expedientes y leer un expediente individual con su token aleatorio. No puede listar la bandeja, derivar ni asignarse permisos.
- La clave de seguimiento es una credencial: quien la tenga puede consultar el expediente y su adjunto. No la publiques en GitHub ni la compartas en redes.
- El correlativo y el expediente se escriben en una transacción con una vinculación privada. Las reglas rechazan incrementos del contador que no creen el expediente correspondiente.
- Las nuevas observaciones administrativas se guardan en `notasInternas`, accesible solo para administradores. El historial público muestra fecha, estado y área.
- La clave del cargo se conserva en la sesión de esa pestaña para permitir recargar la página. Guarda el cargo antes de cerrar la pestaña.
- Los adjuntos no pueden sobrescribirse desde el cliente. Si una carga se completa pero el registro falla, puede quedar un archivo huérfano en Storage; el administrador debe revisarlo antes de eliminarlo. No se borra automáticamente ante una respuesta incierta.
- Esta edición no incluye limitación de frecuencia en servidor. Antes de una apertura masiva, configura App Check y controles contra abuso adecuados al volumen esperado. Las reglas de validación por sí solas no son un mecanismo antispam.

## Actualizar una instalación anterior

Conserva una copia de los archivos y de los datos antes de actualizar. No se importan automáticamente expedientes del servidor local o del navegador. Los expedientes existentes en Firebase permanecen en sus colecciones, y el contador anterior que contiene solo `value` sigue siendo compatible.

**Notas antiguas:** las observaciones que la versión anterior guardó dentro de `expedientes.log` siguen estando en ese documento. Esta edición separa las nuevas notas, pero no migra ni borra las anteriores. Antes de usar expedientes antiguos con notas confidenciales, trasládalas a `notasInternas` mediante la consola o una migración administrativa y limpia las copias del historial público. Conserva primero una copia de respaldo. Las reglas de cliente impiden reescribir el historial.

## Solución de problemas

| Problema | Comprobación |
|---|---|
| GitHub muestra 404 | Comprueba el origen de Pages y que `docs/index.html` fue subido. Espera a que Actions termine. |
| El diseño aparece, pero no registra | Verifica Internet, Firestore `(default)` y las reglas de esta versión. |
| Permisos insuficientes | Comprueba las reglas completas y `admins/UID` con `role: admin`. |
| El administrador no ingresa | Habilita Email/Password y revisa correo, contraseña y dominio autorizado. |
| Falla únicamente el adjunto | Comprueba bucket, Storage, reglas, plan y tamaño/tipo del archivo. |
| PowerShell bloquea npm.ps1 | Ejecuta `npm.cmd` en lugar de `npm`. |

## Verificación y límites

Las pruebas incluidas usan un servicio simulado para comprobar registro, reintentos, consulta, notas privadas y conflictos de revisión. No sustituyen una prueba en tu proyecto Firebase. Consulta `VERIFICACION.md` para las comprobaciones realizadas en esta entrega.

No se ha creado un repositorio ni publicado una URL de GitHub desde esta entrega. Las credenciales de administración y los expedientes no se incluyen en el ZIP. Las imágenes y la reseña institucional se conservan de la versión anterior, cuya fuente indicada es https://iestmst.edu.pe/presentacion/.

Referencias de configuración:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/firestore/security/rules-fields
