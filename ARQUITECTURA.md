# Organización del proyecto

La tienda es un monolito modular Express con vistas EJS. Las páginas y la API
comparten casos de uso; no realizan solicitudes HTTP al propio servidor.

| Directorio           | Responsabilidad                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routes/`     | Rutas, permisos, middleware y carga de archivos.                                                                                                           |
| `server/pages/`      | Adaptar solicitudes HTTP a páginas EJS y redirecciones.                                                                                                    |
| `server/controller/` | Adaptar solicitudes HTTP a respuestas API, descargas y recursos.                                                                                           |
| `server/business/`   | Operaciones, validaciones de negocio y consultas a MongoDB.                                                                                                |
| `server/model/`      | Esquemas, relaciones y definiciones de índices.                                                                                                            |
| `server/validation/` | Esquemas de entradas HTTP compartidos con los servicios de administración.                                                                                 |
| `server/services/`   | Utilidades compartidas: importes, paginación, CSV y respuestas.                                                                                            |
| `server/templates/`  | Composición de correos; no envía mensajes ni importa servicios de negocio.                                                                                 |
| `server/config/`     | Configuración e integraciones, incluido el transporte Brevo.                                                                                               |
| `views/`             | Presentación EJS, includes y datos estructurados JSON-LD.                                                                                                  |
| `public/`            | CSS, JavaScript de navegador, imágenes y fuentes; URLs canónicas `/css`, `/js` y `/img`. El alias `/assets` se conserva temporalmente para compatibilidad. |

## Reglas para nuevos cambios

- Las rutas aplican autenticación, permisos y CSRF antes de ejecutar una operación.
  Los servicios no reciben `req` ni `res`. Los campos de control no se persisten.
- Las páginas y controladores no importan `server/model` ni construyen consultas
  MongoDB. Usan servicios de negocio como `cartService`, `orderService`,
  `reviewService`, `accountService` y `salesService`; así las mismas reglas se
  comparten entre HTML, API y tareas de mantenimiento.
- Perfil, catálogo, proveedores, usuarios, roles, pedidos y ventas comparten
  servicios entre páginas y API. Pedidos y ventas se escriben mediante
  `commerceService`; los servicios de lectura no crean caminos alternativos.
- Los dominios grandes conservan una fachada pequeña y separan sus
  responsabilidades internas: pagos usa `paymentValidation`,
  `paymentPersistence`, `paymentSettlement`, `paymentMaintenance` y
  `paymentResolution`; entregas usa `deliveryRules` y
  `deliveryOperations`; usuarios usa `userRules` y `userRepository`; la rifa
  usa `raffleRules` y `raffleRepository`; las analíticas de ventas usan
  `salesAnalyticsPipelines`, `salesAnalyticsRepository` y
  `salesAnalyticsPresentation`. La exportación separa filtros y consultas en
  `salesExportQuery.js`, serialización CSV en `salesCsvFormat.js` y métricas en
  `salesAnalyticsReports.js`; `analyticsExport.js` conserva la fachada pública. Estos módulos siguen formando un único
  monolito y no cambian el contrato de las rutas existentes.
- El controlador legado `cart_controller.js` conserva sus exportaciones como fachada. Las operaciones del carrito viven en `cartController.js`, el checkout en `checkoutController.js` y los webhooks/reintentos de pago en `paymentController.js`.
- Las notificaciones separan la creación de eventos y la cola en `emailNotificationQueue.js` del envío, la recuperación de reclamos vencidos y los reintentos en `emailNotificationWorker.js`. `emailNotificationService.js` conserva las exportaciones que consumen los flujos actuales.
- Los listados administrativos siempre tienen límites. `queryPage` centraliza
  conteo, orden, desplazamiento y máximo de 50 registros. Los detalles de una
  página de ventas también están acotados.
- Las reglas de permisos de usuarios y roles se conservan en sus servicios.
  `users:manage` no permite cambiar roles y una cuenta no puede elevar su propio rol.
- Los productos validan relaciones, importes en centavos, fotografías y stock
  original. Una edición obsoleta devuelve 409 y limpia las imágenes nuevas sin uso.
- `BASE_URL` sirve para enlaces públicos y SEO, no para consultar datos internos.
- El JavaScript ejecutable va en archivos `.js`; los estilos van en `.css`.
  JSON-LD es la excepción declarativa en EJS. Los correos pueden tener estilos
  inline por compatibilidad con clientes de correo.
- `public/css/core/theme.css` contiene los colores comunes; `public/css/core/reset.css`
  y `public/css/core/layout.css` contienen la base estructural; `public/css/components/ui.css`
  concentra botones, tablas, formularios, tarjetas y modales; y
  `public/css/components/admin.css` contiene la estructura compartida del panel.
  Estas hojas se cargan antes del CSS de cada página. Los estilos propios se
  migran gradualmente a `public/css/pages/`; los archivos CSS que permanecen
  en la raíz son alias temporales para no romper enlaces antiguos. Los
  componentes deben reutilizar estos tokens y no declarar paletas locales.
  `core/layout.css` solo expone utilidades con intención (`.payment-link`,
  `.product-description-truncated` y `.summary-text`), nunca `.container`.
  La navegación y el pie usan prefijos `.app-*` para que sus reglas no
  interfieran con Bootstrap ni con las pantallas de catálogo, carrito o pago.
- Las vistas grandes se componen con parciales por responsabilidad. El encabezado público divide metadatos, navegación y
  promoción del sorteo en `views/include/header/`; `views/include/orders/` contiene bloques compartidos de pedidos.
  El carrito, las reseñas y los puntos de pago mantienen sus parciales junto a la vista (`partials/`).
  El CSS del carrito se divide por layout, artículos, resumen, responsive, catálogo y agregado de productos
  en `public/css/pages/cart/`. Los parciales no cargan CSS ni JavaScript; esos recursos se cargan una sola vez
  en la vista principal.
- Las páginas de comercio separan checkout, pedidos del cliente y administración de pagos.
  `renderCommerce.js` conserva una fachada pequeña para las rutas existentes y delega en sus módulos de página.
- Los encabezados (`_header`, `_headerAdmin` y `_headerDealer`) cargan únicamente los
  recursos base. `server/config/pageResources.js` registra `pageCss` y `pageJs` por
  plantilla; el layout los valida, elimina duplicados y los inserta de forma diferida.
- No introducir dependencias circulares ni importar páginas o controladores
  desde servicios de negocio. Los cambios de esquema e índices requieren una
  migración nueva; las migraciones publicadas conservan su checksum.
- Los módulos JavaScript nuevos y ya normalizados usan `camelCase`
  (`authController.js`, `productController.js`, `userController.js`,
  `saleController.js`, `paymentPointPage.js`) y los estilos propios usan
  `kebab-case` en minúsculas (`add-product-billing-point.css`,
  `create-products.css`, `edit-profile.css`, `read-orders.css`, `stock.css`).
  Los nombres heredados se migran de forma gradual para no romper rutas ni
  referencias de despliegues existentes.

## Comprobaciones locales

```bash
npm ci
npm run lint
npm run format:check
npm test
```

ESLint incluye servidor, scripts, migraciones, pruebas y JavaScript del navegador.
Prettier descubre automáticamente JS, CSS, JSON, documentación y configuración;
no depende de una lista cerrada de archivos. En EJS se normalizan espacios finales
y saltos de línea; sus expresiones no se reformatean como HTML. EJS se compila en `npm run check`
y se comprueban sus includes, recursos, enlaces y separación de estilos/scripts.
Las migraciones se excluyen del reformateo para conservar su identidad.

Las pruebas de formularios arrancan Express en localhost, utilizan sesiones y
CSRF reales y sustituyen únicamente las consultas de persistencia. Comprueban
guardado válido, rechazos, permisos y ausencia de escrituras no autorizadas.
Esto no sustituye las pruebas contra un MongoDB real: para estas últimas ejecutar
`npm run test:integration` con `MONGOD_BINARY` apuntando a un `mongod` local.
El ejecutor crea una base temporal y no utiliza Atlas ni las credenciales de producción.

Las verificaciones de calidad y las pruebas ya forman parte del workflow de CI
para Node 22 y 24. Verificar esos resultados antes de publicar los cambios.
