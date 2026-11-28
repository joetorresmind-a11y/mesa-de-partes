# Verificación de la versión 8.0.0

## Comprobaciones realizadas

**Aplicación: 25 pruebas automáticas aprobadas, sin fallos.** Ejecutadas con `npm run check` en Node.js 24; el proyecto declara Node.js 22 o superior. Incluyen:

- Registro completo, campos obligatorios y documento principal.
- Correlativo y reintento sin duplicar el registro.
- Vista pública sin DNI, contactos, domicilio, descripción ni notas privadas.
- Consulta limitada al área y rechazo de derivaciones del personal.
- Respuestas con adjunto y reintentos sin duplicarlas.
- Separación de notas internas y control de cambios concurrentes.
- Alta de personal con sesión secundaria, sin reemplazar la sesión administrativa ni guardar la contraseña en Firestore.
- Autorización de archivos: rechazo de sesión ausente, token no validado por Firebase, otra área y cuenta desactivada.
- Validación de tamaño y firma de archivo; descarga, preflight, origen y bloqueo de sobrescritura.
- Rutas de GitHub Pages y archivo de entrada en la raíz.
- Diagnóstico que distingue la función anterior de la versión 8.
- Plan de despliegue con proyecto validado, CLI fijada y ejecución sin shell.

Los servicios externos de estas pruebas Node están simulados. No certifican la configuración de una cuenta real.

**Reglas de Firestore: 15 grupos de comprobaciones aprobados en el emulador real**, usando `npm run test:rules` y el proyecto local `demo-mesa-tests`. Se probó:

- Un usuario del área puede consultar su bandeja; otro no puede leer ese expediente, ni con su identificador.
- El público no puede leer expedientes privados, listar seguimiento ni consultar notas internas.
- Personal sin privilegios no puede crear cuentas ni asignarse el rol de administrador.
- La respuesta exige autor y ruta válidos y actualización coherente del seguimiento.
- El cambio de área por administración retira el acceso anterior y habilita el nuevo.
- Los datos inválidos y el registro incompleto no consumen el correlativo.
- La cuenta desactivada pierde acceso aunque conserve su sesión.

Las denegaciones esperadas aparecen en los mensajes del emulador; son parte de la prueba.

**Interfaz revisada en navegador** con una copia separada y servicios en memoria: portada, formulario de tres pasos, campos vacíos, selección de adjunto, confirmación, cargo, bandeja, respuesta de texto y aparición de esa respuesta en la consulta, administración de cuentas y cierre de sesión. Se revisó el diseño en escritorio y en un marco de 390 px para el comportamiento móvil. Se corrigió el menú móvil para mostrar las opciones sin desplazamiento horizontal. Esto no equivale a una prueba en dispositivos físicos.

La copia de revisión y sus expedientes ficticios no están en el ZIP. El paquete entregado utiliza la integración real de Firebase y Supabase.

**Asistente de publicación:** se comprobó la ayuda de Supabase CLI 3.4.0 y la disponibilidad de `--remote` y `--use-api`. No se ejecutó el despliegue en tu proyecto. La invocación para Windows está preparada sin `shell: true`; no se probó en un sistema Windows real.

## Comprobación pendiente en tu instalación

No se inició sesión con tus credenciales ni se modificaron Firebase, Supabase o GitHub. Antes de recibir documentos reales, publica las reglas y la función nuevas, actualiza GitHub y completa la prueba del apartado 8 de README.md. Debes comprobar en tus servicios el alta de cuentas reales, la carga y descarga de documentos, las respuestas, los permisos por área y el seguimiento de los expedientes anteriores.

El sistema no genera un respaldo del Ministerio de Educación: el pie cita la referencia institucional publicada por el instituto y enlaza al Ministerio.
