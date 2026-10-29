# Tienda Galindez: puesta en producción

Esta actualización conserva el catálogo, la paginación y las reseñas, y añade controles de compra, pagos, archivos y cuentas. No despliega automáticamente ni usa las claves de tu cuenta. Las pruebas de pagos emplean respuestas simuladas de Wompi y una base temporal; antes de cobrar hay que completar una compra en el sandbox real y verificar la configuración externa.

## 1. Aplicar la actualización en VS Code

1. Guarda una copia de tu carpeta actual y una copia de seguridad de MongoDB.
2. Detén `npm run dev` con Ctrl+C.
3. Extrae los archivos de la actualización **dentro de la carpeta del proyecto**, donde está `package.json`, y acepta reemplazar los archivos. No crees una segunda carpeta de proyecto dentro de la primera.
4. Conserva tu `.env` privado. La actualización contiene solo `.env.example`.
5. Usa Node.js 22.23.4 o una versión actualizada de la rama 24. En PowerShell, dentro del proyecto:

```powershell
npm ci
npm run check
npm test
npm run dev
```

Abre `http://localhost:3000`. No necesitas Docker ni instalar MongoDB para desarrollar con Atlas. `npm test` ejecuta las pruebas que no necesitan base y marca las integraciones como omitidas; esto no equivale a haber ejecutado toda la suite.

Si acabas de clonar, copia `.env.example` a `.env`, completa `MONGO_URI` y genera `SESSION_SECRET` con:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run seed:local
```

Usa bases diferentes para desarrollo y producción. La URI debe incluir el nombre de la base después de `.mongodb.net/`. No copies una URI ni una contraseña en un chat o en el repositorio.

Añade a tu `.env` existente las variables nuevas:

```dotenv
PAYMENTS_ENABLED=false
SHIPPING_PRICE=5000
FREE_SHIPPING_FROM=30000
CSV_EXPORT_MAX_ROWS=100000
```

Los importes son COP. El servidor trata los precios del catálogo como precios finales con impuestos incluidos. Valida esta política y los costes de envío con los responsables del negocio antes de vender; el software no determina las obligaciones tributarias ni emite facturación electrónica.

### Importe monetario y migración

Los nuevos pedidos, ventas, detalles y precios de catálogo calculan y guardan sus importes en enteros de centavos (`totalCents`, `subtotalCents`, `precioUnitarioCents`, `precioVentaCents`, etc.). Los campos anteriores en COP se conservan temporalmente para que las vistas y el historial existente sigan siendo legibles; no deben usarse para nuevas operaciones financieras.

Antes de activar cobros en una base existente, haz una copia de seguridad y ejecuta primero el diagnóstico:

```powershell
npm run migrate:money
```

Si el resultado es correcto, aplica el backfill explícitamente:

```powershell
$env:MONEY_MIGRATION_APPLY = "true"
npm run migrate:money
Remove-Item Env:MONEY_MIGRATION_APPLY
```

El comando es idempotente, no elimina campos antiguos y muestra cuántos documentos revisó y actualizó. Verifica una muestra de pedidos, ventas y productos y conserva la copia de seguridad antes de operar.

## 2. Qué cambió

| Área | Comportamiento |
| --- | --- |
| Compra | Precios consultados en MongoDB, cálculo en centavos, cantidades enteras y protección contra doble clic. |
| Inventario | Reserva atómica al crear la orden; una unidad no puede venderse a dos compradores. |
| Vencimiento | La reserva dura 30 minutos. El Cron de mantenimiento revisa vencimientos cada minuto. Un pago conocido que sigue pendiente conserva su reserva hasta conciliación. |
| Wompi | Firma del webhook, consulta privada al proveedor y comparación de referencia, importe y moneda. Bandeja de eventos persistente y reintentos. |
| Correo de pedidos | Confirmación de pedido, cambios de estado, aviso de envío y entrega. Los eventos se guardan en MongoDB, se envían por Brevo y se reintentan si el proveedor falla. |
| Sorteo | Cada pedido pagado que cumple el monto recibe un número único dentro de una ronda. Al seleccionar ganador se encola un aviso por Brevo y `/sorteo` publica el número ganador, la fecha y el total de participaciones, sin nombres ni correos. |
| Participaciones | El panel administrativo consulta las participaciones por páginas desde MongoDB y permite elegir 10, 25 o 50 filas; no carga ni limita la lista a 500 registros. Al reiniciar, la ronda anterior queda cerrada y sus participaciones se conservan en modo histórico. El ganador se obtiene con `$sample` en MongoDB, sin cargar la colección en Node. |
| Reparto | El administrador asigna pedidos pagados desde `/admin/delivery`. El repartidor solo puede consultar y avanzar los pedidos asignados; el cliente ve el historial público de entrega en `/mis-pedidos`. |
| Cobro tardío o duplicado | El cobro queda registrado y se muestra una incidencia. No se envía automáticamente un pedido sin reserva confirmada. |
| Caja | Registrar un pedido no lo marca como pagado. Un administrador confirma expresamente que recibió el dinero. |
| Cliente | `/mis-pedidos` y consulta del estado del pago y entrega. El carrito no se vacía al abrir Wompi. |
| Administración | `/admin/payments` para caja, incidencias y conciliación por ID de Wompi; `/admin-analytics?period=week` o `?period=month` para decisiones de ventas. |
| Exportación | `/read-sales` permite filtrar por fechas, estado de pago y canal, y descargar `/api/ventas/export.csv` con una fila por producto vendido. |
| Integridad contable | La única ruta de escritura de pedidos, ventas y detalles es `commerceService`. Los controladores antiguos de venta/detalle son de solo lectura y sus operaciones directas de crear, editar o eliminar están bloqueadas con `409`. |
| Entrega | Solo permite PAGADA → PREPARANDO → ENVIADA → ENTREGADA, con pago y stock confirmados. El administrador asigna el repartidor y el repartidor solo actualiza pedidos que le pertenecen. |
| Archivos | Nuevas fotos en MongoDB GridFS, convertidas a WEBP, sin metadatos y con límites de tamaño. Las fotos incluidas en Git siguen funcionando. |
| Cuentas | Contraseñas nuevas de al menos 12 caracteres, códigos con hash y consumo atómico, recuperación por enlace de un uso y revocación de sesiones. |
| Seguridad | CSRF también con archivos, límites de intentos en MongoDB, CSP con nonce, cookies seguras y errores sin detalles internos. |
| Contrato API | `/api` y las rutas JSON del carrito responden `{ success, data, error, requestId }`; los errores de validación incluyen detalles por campo sin exponer datos internos. |
| Calidad | ESLint, Prettier y las pruebas se ejecutan obligatoriamente en GitHub Actions para Node 22 y 24 antes de aceptar cambios en `main`. |

El repartidor tiene acceso únicamente a los pedidos pagados que el administrador le asignó. Desde `/admin/delivery`, el administrador puede asignar, reasignar o retirar una asignación antes de que el pedido salga en camino. El repartidor puede registrar `PREPARANDO`, `ENVIADA` y `ENTREGADA`, y añadir una nota visible para el cliente.

## 3. Preparar Render

El archivo `render.yaml` permite crear un servicio Node. Para tu servicio ya existente, revisa manualmente:

| Opción | Valor |
| --- | --- |
| Build Command | `npm ci --omit=dev && npm run check` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| NODE_ENV | `production` |
| NODE_VERSION | `22.23.4` o una revisión posterior compatible de la rama 22 |
| BASE_URL | Tu origen HTTPS público, sin rutas ni barra final |
| MONGO_URI | URI de Atlas con base exclusiva de producción |
| SESSION_SECRET | Secreto aleatorio distinto del local, de al menos 32 caracteres |
| BREVO_API_KEY / EMAIL_USER | Clave válida y remitente verificado |
| PAYMENTS_ENABLED | `false` hasta completar las pruebas de pago |
| WOMPI_ENV | `sandbox` para pruebas, `production` para cobros reales |

Si despliegas con el `Dockerfile`, la imagen usa `npm ci --omit=dev`, ejecuta el
proceso con el usuario sin privilegios `node`, comprueba `/healthz` mediante un
`HEALTHCHECK` interno y declara `SIGTERM` para permitir el cierre ordenado de
MongoDB y las sesiones. El contexto también excluye `.env`, `.git`, `node_modules`
y logs mediante `.dockerignore`.

Configura además las cuatro claves `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_KEY` y `WOMPI_EVENTS_KEY` del mismo entorno. No uses `LOCAL_ADMIN_PASSWORD` en Render. No subas `.env`, `config.env` ni `node_modules` a Git.

### Mantenimiento programado

El servicio web no ejecuta conciliaciones, vencimientos, limpieza de imágenes ni envío de la bandeja de correos. El segundo servicio de `render.yaml`, `tienda-galindez-maintenance`, ejecuta `npm run maintenance` cada minuto con la expresión `* * * * *` (UTC). Sus variables sensibles usan `fromService` para heredar los valores del servicio web existente `E-Commerce-Tienda-Galindez`; no las dupliques manualmente. Si el nombre de tu servicio es diferente, cambia ese nombre en las referencias antes de sincronizar el Blueprint.

Para probarlo en local, ejecuta `npm run maintenance` con el `.env` apuntando a una base de datos de desarrollo. El proceso aplica las migraciones pendientes, valida que Atlas o un replica set estén disponibles, registra un resultado JSON en los logs y termina; si falla devuelve un código distinto de cero para que Render marque la ejecución como fallida. Render no solapa dos ejecuciones del mismo Cron Job.

El proceso falla de forma explícita si faltan variables esenciales o si intentas usar el secreto local de ejemplo en producción. Revisa **Logs** si `/healthz` devuelve error. El inicio exige Atlas o un replica set: MongoDB independiente no ofrece las transacciones que necesita la tienda.

### Diagnóstico temporal de formularios CSRF

Si un formulario con imagen devuelve `403`, configura temporalmente `CSRF_DEBUG_LOGS=true` en Render y reproduce la operación. Los logs mostrarán la ruta, `requestId`, presencia y longitud de los tokens, cookie de sesión, origen y etapa del parser; nunca imprimen el token ni la cookie. La página HTML del error también muestra esos metadatos y el encabezado `X-CSRF-Reason`. Después de identificar el problema, vuelve a `false` o elimina la variable.

El servicio web puede suspenderse sin detener estas tareas: el Cron de Render las ejecuta por separado. Revisa también memoria, almacenamiento de Atlas y límites del plan. Las imágenes nuevas consumen espacio de MongoDB, no del disco efímero de Render.

### Renderizado y API interna

Las páginas públicas de catálogo, búsqueda, categorías, marcas, promociones, detalle y sitemap reutilizan `server/business/catalogService.js` directamente. Esto evita llamadas Axios al dominio público desde el propio servidor, reduce latencia y evita duplicar autenticación de sesión. La API `/api/productos` sigue disponible para el navegador y consumidores externos; ambas capas comparten el mismo servicio y contrato de datos.

Si no tienes un administrador en esa base, configura temporalmente `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD` y ejecuta desde un entorno autorizado:

```text
npm run seed:admin
```

El comando crea los cuatro roles (`SuperAdmin`, `Admin`, `Cliente` y `dealer`) y, si el correo no existe, crea un administrador verificado con el rol reservado `SuperAdmin`; también normaliza `Admin` para que no tenga `roles:manage`. No cambia una cuenta existente ni restablece contraseñas. Retira `INITIAL_ADMIN_PASSWORD` después de usarlo. Si tu plan no tiene Shell, puedes ejecutarlo desde tu equipo apuntando temporalmente a esa base, y después volver a la URI de desarrollo.

Si ya tienes una cuenta operativa y necesitas convertirla en la cuenta de emergencia, crea primero el rol `SuperAdmin` con este comando usando un correo nuevo y, después de verificar el acceso, cambia únicamente el `rol` de la cuenta elegida desde MongoDB Atlas o una tarea autorizada. Si lo haces manualmente en Atlas, incrementa también `authVersion` para revocar las sesiones anteriores. No envíes contraseñas ni URI de MongoDB al repositorio o al chat.

La opción recomendada para una cuenta existente es configurar temporalmente `SUPERADMIN_EMAIL` y ejecutar `npm run promote:superadmin`. Solo acepta cuentas que ya sean `Admin` o `SuperAdmin`, no cambia la contraseña y revoca las sesiones incrementando `authVersion`. Elimina la variable después de usarla.

## 4. Probar Wompi antes de cobrar

1. Configura claves sandbox y `PAYMENTS_ENABLED=true` en un entorno de prueba.
2. Configura en el panel de Wompi el webhook público:
   `https://TU-DOMINIO/carrito/get_wompi_webhook`.
3. Haz compras con los medios de prueba oficiales. Comprueba aprobación, rechazo y pago pendiente.
4. Confirma que cada compra aprobada genera una sola venta y que el inventario se descuenta una sola vez. Repite el webhook y recarga el retorno para comprobarlo.
5. Verifica que el retorno muestra el estado del servidor. Volver del checkout, por sí solo, no confirma una compra.
6. Comprueba una reserva vencida y un evento que llegue tarde. La incidencia debe quedar visible para la tienda.
7. Configura las claves de producción, cambia `WOMPI_ENV` y ejecuta `npm run check:production`. Este comando valida variables; **no certifica** pagos, correo, restauración ni requisitos legales.
8. Realiza una compra real controlada y autorizada, comprueba el cobro en Wompi, el pedido, la entrega y el procedimiento de devolución.

Configura en Brevo un remitente verificado y prueba en este orden: creación de pedido, pago confirmado, cambio a preparación, envío y entrega. En local, si no configuras `BREVO_API_KEY` y `EMAIL_USER`, los correos se registran de forma segura en la terminal. En producción, un evento que no pueda enviarse queda en la bandeja de MongoDB y se reintenta con espera progresiva; revisa los logs `order_email_failed` si supera los intentos permitidos.

No introduzcas tarjetas reales durante las pruebas sandbox. La aplicación usa el checkout alojado de Wompi y no guarda tarjetas.

## 5. Atender incidencias y pedidos anteriores

- **Pago sin webhook:** consulta el ID desde el panel de Wompi y usa `/admin/payments` → Consultar y conciliar. También puedes ejecutar `npm run payments:reconcile -- ID_TRANSACCION`.
- **Proveedor temporalmente caído:** el evento firmado queda guardado y vuelve a consultarse. Una ejecución manual de `npm run payments:reconcile` procesa los eventos pendientes y vencimientos.
- **Segundo cobro o pago sin reserva:** no despaches automáticamente. Comprueba el dinero recibido y el inventario; gestiona la devolución en Wompi cuando corresponda y registra su comprobante. Para un pago tardío de esta versión, también puedes confirmar disponibilidad y reservar de nuevo desde el pedido, después de verificarlo con el cliente. Un segundo cobro se resuelve en la incidencia de ese ID de transacción; no marques como devuelta la compra original si solo devolviste el cobro adicional. Los cambios conservan administrador, motivo, fecha y referencia de comprobante.
- **Devoluciones:** esta versión no mueve dinero para reembolsar. Primero efectúa y verifica la devolución total con el proveedor; después usa «Disponibilidad o devolución ya realizada» en el pedido y registra el motivo y comprobante. Solo marca reponer unidades si están físicamente disponibles en la tienda. El sistema evita registrar la misma devolución dos veces y excluye esas ventas de los indicadores. Las devoluciones parciales requieren gestión externa y no están modeladas por esta versión.
- **Pedidos antiguos:** se conservan, pero no se adivina si su inventario ya fue descontado. Ejecuta `npm run audit:data` antes del lanzamiento. Los pedidos sin el nuevo estado de inventario requieren revisión del historial antes de incorporarlos al nuevo flujo; no los corrijas con actualizaciones masivas sin cotejar pagos y stock.
- **Informe de ventas:** usa ventas con estado `PAGADO`, compara los últimos 7 o 30 días con el periodo anterior y muestra ingresos, ticket promedio, margen bruto estimado, canales, productos, categorías, stock bajo y productos sin rotación. La ganancia se calcula con el costo guardado en cada detalle; no incluye comisión de Wompi, costos reales de envío ni obligaciones tributarias.
- **Exportación CSV:** desde `/read-sales` filtra el rango, estado y canal antes de pulsar «Exportar CSV». El archivo incluye pedido, fecha, cliente, producto, cantidad, precios, costos, envío, descuento, total y ganancia bruta por línea. El límite configurable es `CSV_EXPORT_MAX_ROWS` (100.000 por defecto); si necesitas periodos mayores, exporta por rangos de fecha.
- **Códigos de verificación antiguos:** solicita un código nuevo después de actualizar, ya que ahora se guardan hashes.
- **Imágenes antiguas que solo existían en Render:** expórtalas antes del despliegue y vuelve a subirlas desde el administrador. Un archivo perdido en el disco anterior no puede recuperarse con esta actualización.

## 6. Pruebas y mantenimiento

### Contrato y validación de API

Las rutas JSON pasan por `server/middleware/apiContract.js`. Una respuesta
exitosa tiene esta forma:

```json
{
  "success": true,
  "data": { "items": [] },
  "error": null,
  "requestId": "..."
}
```

Una respuesta rechazada usa `success: false`, `data: null` y un objeto `error`
con `code`, `message` y, cuando la entrada no cumple el esquema, `details`.
Cada `requestId` puede buscarse en los logs de Render. Los validadores de
`server/validation/schemas.js` usan Zod para comprobar identificadores,
paginación, autenticación, carrito, pedidos, reseñas y operaciones
administrativas antes de ejecutar la lógica de negocio.

Los alias de compatibilidad en el primer nivel se mantendrán mientras los
clientes externos migran a `data`; no deben usarse para nuevas integraciones.

### Linting y formato

Antes de subir cambios ejecuta:

```bash
npm ci
npm run lint
npm run format:check
npm test
```

Para corregir automáticamente el formato de los archivos mantenidos:

```bash
npm run format
```

El flujo `.github/workflows/node.js.yml` repite ESLint, Prettier y las pruebas
para Node 22 y Node 24. El trabajo debe terminar correctamente antes de mezclar
una solicitud en `main`.

### Índices y planes de consulta

El arranque aplica las migraciones versionadas pendientes y deja `autoIndex` de
Mongoose desactivado en producción. La migración inicial crea los índices de
ventas, detalles, productos, stock, usuarios, pedidos y proveedores; las
ejecuciones se registran en `schema_migrations` y usan un bloqueo distribuido.
Para consultar el estado sin aplicar cambios:

```bash
npm run migrate:status
npm run migrate:dry-run
```

Para aplicar una migración pendiente desde un entorno autorizado:

```bash
npm run migrate
```

No edites una migración que ya se haya aplicado. Añade un archivo nuevo con un
identificador ordenado (`YYYYMMDDNNNN-nombre.js`). El proceso verifica el
checksum de cada archivo y se detiene si detecta que una migración aplicada fue
modificada. Antes de crear un índice único en una base existente, respalda y
revisa los duplicados; la aplicación no borra índices automáticamente.

Para revisar los planes sobre datos reales sin modificar documentos, ejecuta:

```bash
MONGO_URI="<base-de-desarrollo-o-copia>" npm run explain:queries
```

El comando usa `explain("executionStats")` en las agregaciones de analítica y
en los listados administrativos. Si quieres convertir un `COLLSCAN` en un
fallo de la revisión, añade `EXPLAIN_FAIL_ON_COLLSCAN=true`. No ejecutes este
diagnóstico contra producción sin una ventana de lectura autorizada.

```text
npm run check
npm test
npm run test:integration
npm audit --omit=dev
```

La integración necesita el ejecutable `mongod`, no Docker. Crea un replica set y una base temporales; no lee tu `.env` para elegir base ni usa tu Atlas. Si `mongod` no está en PATH, en PowerShell configura `$env:MONGOD_BINARY` con la ruta de `mongod.exe`. GitHub Actions descarga un ejecutable temporal y ejecuta las pruebas para Node 22 y 24, instalando las dependencias como en Render. Comprueba en la solicitud de cambios que ambas ejecuciones de «Pruebas de la tienda» estén correctas antes de incorporar la actualización a `main`.

El servidor cierra conexiones al recibir la señal de parada. Supervisa `/healthz`, errores HTTP, eventos de pago pendientes, almacenamiento de imágenes y copias de seguridad. Guarda copias de la base completa, incluidas las colecciones `media.files` y `media.chunks`, y practica una restauración en otra base. Una copia sin prueba de restauración no demuestra recuperación.

Las páginas públicas de privacidad, términos de compra, envíos, cambios y devoluciones y reclamaciones están disponibles en `/privacidad`, `/terminos`, `/envios`, `/cambios-devoluciones` y `/reclamaciones`. Antes de abrir ventas, completa los datos configurables (`LEGAL_*`) con la identificación y contacto reales del negocio y valida los textos con asesoría legal/contable cuando corresponda.

Referencia técnica: [Render](https://render.com/docs/node-version), [persistencia en Render](https://render.com/docs/disks), [checkout Wompi](https://docs.wompi.co/en/docs/colombia/widget-checkout-web/), [eventos Wompi](https://docs.wompi.co/en/docs/colombia/eventos/), [seguimiento de transacciones](https://docs.wompi.co/en/docs/colombia/seguimiento-de-transacciones/).

