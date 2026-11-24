# Comprobaciones de esta entrega

Fecha: 24 de noviembre de 2026.

## Ejecutadas correctamente

- Comprobación de sintaxis de JavaScript y del servidor estático.
- Ocho pruebas locales: rutas relativas para repositorios, contenido del artefacto público, configuración de publicación, registro sin cuenta, reintento sin duplicación, validación de datos, consulta con clave, separación de notas, conflicto de revisión y navegación sin conexión (algunas pruebas agrupan varios casos).
- Emuladores oficiales de Firestore y Storage con un proyecto ficticio `demo-mesa-tests`: aceptación de registro transaccional, rechazo de contador aislado, rechazo de un registro con correlativo reutilizado, lectura individual con token, rechazo de lista pública, rechazo de asignación pública de administrador, derivación administrativa, notas privadas, lectura administrativa y ausencia del token en el contador público.
- Storage: aceptación de PDF, lectura individual, rechazo de sobrescritura, rechazo de tipo HTML y rechazo del listado público de adjuntos.

## No verificadas en producción

No se ha accedido a tu consola, cambiado la facturación, creado tu cuenta administrativa ni publicado en GitHub. Falta probar el dominio publicado y los servicios activados en tu proyecto real.

El navegador automatizado del entorno no pudo iniciarse por una restricción del sistema. No se completó una inspección visual automatizada de escritorio y móvil; se incluyeron reglas CSS adaptables y pruebas de navegación mediante DOM simulado.

## Repetir las pruebas

Desde la raíz, `npm.cmd run check` ejecuta las pruebas locales sin descargar dependencias.

Para los emuladores, necesitas Node.js 22 o superior y una versión de Java compatible con Firebase Emulator Suite (Java 21 o superior). Desde la carpeta `validation` ejecuta:

```powershell
npm.cmd install
npm.cmd test
```

Se utilizan solo emuladores y el proyecto ficticio `demo-mesa-tests`; estos comandos no escriben en tu Firebase real. Los mensajes de permiso denegado son esperados en los casos que comprueban un acceso prohibido. La prueba final debe terminar con código 0.
