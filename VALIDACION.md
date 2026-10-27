# Validación de la actualización

Fecha: 26 de octubre de 2026.

- Sintaxis de JavaScript, compilación de plantillas EJS y carga de rutas verificadas con `npm run check`.
- 45 pruebas automatizadas con MongoDB 8.0.17 temporal en replica set, ejecutadas en Node.js 24.22.1; sin fallos ni pruebas omitidas en la integración completa.
- Cobertura: doble envío de compra, competencia por la última unidad, pagos repetidos, importe/moneda inválidos, liberación de reservas, pagos pendientes/tardíos, caja, estados de entrega, registro de devolución total y estadísticas que excluyen devoluciones.
- Seguridad comprobada: CSRF con multipart, CSP, contraseñas y normalización de correo, verificación de un solo uso, recuperación y revocación de sesiones, permisos de administrador, rechazo de imágenes falsas y persistencia de imágenes WEBP.
- Se conservan y pasan las pruebas de publicación, edición, borrado, paginación, respuesta y moderación de reseñas.
- Arranque del servidor real, `/healthz`, cookie Secure/HttpOnly/SameSite y cabecera HSTS comprobados con configuración de producción y datos ficticios.
- Navegador: búsqueda/agregado en punto de venta, confirmación de caja, checkout móvil, Mis pedidos y recuperación de contraseña. Sin errores JavaScript en ese recorrido. Los recursos externos usados por la prueba se sirvieron de copias temporales para aislar la red; no se certificó disponibilidad del CDN.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas en la revisión realizada. Esta cifra depende de los avisos disponibles al ejecutar la auditoría.

No se usaron la base ni las credenciales reales de la tienda. Wompi se simuló en las pruebas automatizadas: no se hicieron cargos ni devoluciones reales, ni se verificó la cuenta de Brevo. Este documento registra la validación local del paquete; el resultado de GitHub Actions se consulta en la solicitud de cambios, con una ejecución para Node 22 y otra para Node 24. El despliegue sigue pendiente. Sigue `PRODUCCION.md` para la aceptación en tu entorno y la revisión de datos anteriores.

Límites que requieren atención del negocio: configuración y prueba del proveedor de pagos y correo, copias y restauración, migración de pedidos anteriores, tratamiento de devoluciones parciales, políticas comerciales/privacidad y facturación aplicable. Un resultado correcto de las pruebas no sustituye esas comprobaciones.
