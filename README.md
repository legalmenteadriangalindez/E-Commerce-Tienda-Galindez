# Tienda Galindez

Tienda con Express, EJS y MongoDB Atlas. Funciona en VS Code y en Render; Docker es opcional y no se necesita para el flujo local recomendado.

## Desarrollo local

Requisitos: Node.js 22.23.4 o una revisión actualizada de Node 24, npm y una base MongoDB Atlas de desarrollo.

1. Clona el repositorio y abre su carpeta en VS Code.
2. Copia `.env.example` a `.env` si todavía no tienes uno.
3. Completa `MONGO_URI` con una base de desarrollo y cambia `SESSION_SECRET` por un secreto aleatorio.
4. Ejecuta:

```powershell
npm ci
npm run seed:local
npm run dev
```

Abre http://localhost:3000. El correo se muestra en la terminal local si no configuraste Brevo. Para crear el administrador local, completa `LOCAL_ADMIN_EMAIL` y `LOCAL_ADMIN_PASSWORD` y repite `npm run seed:local`.

Los pagos en línea están desactivados inicialmente. Para probar tarjeta o Nequi con el Checkout Web de Wompi, configura las cuatro claves sandbox y `PAYMENTS_ENABLED=true`. El efectivo contra entrega funciona sin activar Wompi; desde el punto de pago administrativo también puedes registrar efectivo en caja.

## Validación

```text
npm run check
npm run lint
npm run format:check
npm test
npm run test:integration
npm run maintenance
npm audit --omit=dev
```

`check` valida JavaScript, plantillas y carga de rutas. `test` omite integraciones si no hay servidor temporal. `test:integration` inicia su propio MongoDB temporal; requiere `mongod` en PATH o la variable `MONGOD_BINARY`. No utiliza tu base de desarrollo o producción.

Las respuestas JSON de `/api` y de las rutas auxiliares JSON del carrito usan el
contrato `{ success, data, error, requestId }`. En errores, `error` contiene un
código, un mensaje seguro y, cuando corresponde, detalles de validación. Las
entradas de las rutas principales se validan con esquemas Zod antes de llegar a
los controladores. `message`, `items` y otros campos de primer nivel se conservan
temporalmente como alias para clientes antiguos; las integraciones nuevas deben
leer `data` y `error`.

La imagen Docker de producción instala únicamente dependencias de producción,
ejecuta Node con el usuario sin privilegios `node`, incluye un `HEALTHCHECK`
contra `/healthz` y usa `SIGTERM` para cerrar el servidor de forma ordenada.
Render puede seguir usando el servicio Node definido en `render.yaml`; el
Dockerfile queda disponible para despliegues basados en contenedor.

ESLint y Prettier se ejecutan en cada cambio mediante GitHub Actions para Node 22
y 24. `npm run format` corrige automáticamente los archivos mantenidos por el
proyecto y `npm run format:check` comprueba que no queden cambios de formato.

### Migraciones de MongoDB

Los índices y cambios de estructura se aplican mediante migraciones versionadas en
`migrations/`. El servidor ejecuta las migraciones pendientes antes de escuchar
peticiones y registra cada versión en `schema_migrations`; un bloqueo distribuido
evita que dos instancias las ejecuten a la vez. No edites una migración que ya
aparezca como aplicada: crea otro archivo con el siguiente identificador.

```bash
npm run migrate:status   # consulta aplicadas y pendientes
npm run migrate:dry-run # comprueba el estado sin aplicar cambios
npm run migrate         # aplica las pendientes
```

En producción `autoIndex` de Mongoose queda desactivado. Los índices se crean o
verifican con `npm run migrate`, sin bloquear cada arranque con `model.init()`.
Si una migración de índice encuentra datos duplicados u opciones incompatibles,
se detiene y debe corregirse con una operación revisada; no elimina índices de
forma automática.

El proceso web no ejecuta tareas periódicas. El workflow `.github/workflows/maintenance.yml` ejecuta `npm run maintenance` cada 15 minutos mediante GitHub Actions (horarios UTC: minutos 7, 22, 37 y 52). Configura los secrets requeridos en GitHub según **PRODUCCION.md**. En local puedes ejecutarlo manualmente después de configurar `MONGO_URI`.

Las vistas públicas de catálogo consultan directamente `server/business/catalogService.js`, que también utiliza la API pública. No hacen peticiones Axios al propio dominio ni dependen de `BASE_URL` para cargar productos; `BASE_URL` se reserva para enlaces públicos, SEO e integraciones externas.

## Producción

Lee **[PRODUCCION.md](PRODUCCION.md)** antes de desplegar. Incluye la aplicación de esta actualización, variables de Render, pruebas de pagos, imágenes, administrador inicial, pedidos anteriores, copias de seguridad y límites de la implementación.

- Configuración de Render en `render.yaml`: servicio web Docker con health check `/healthz` y despliegue después de CI. El mantenimiento programado se ejecuta mediante GitHub Actions; no se crea un Cron Job adicional en Render.
- Comprobación de variables: `npm run check:production`.
- Auditoría de datos anteriores, de solo lectura: `npm run audit:data`.
- Copias y restauración: `npm run backup:restore-drill` crea una copia completa,
  restaura en una base desechable y verifica `media.files` y `media.chunks`;
  consulta la sección **Copias de MongoDB y prueba de restauración** de
  `PRODUCCION.md` antes de ejecutarlo.
- Revisión de planes MongoDB: `npm run explain:queries` con `MONGO_URI` apuntando a una base de desarrollo o a una copia de producción. El informe usa `executionStats` para las analíticas y listados administrativos; activa `EXPLAIN_FAIL_ON_COLLSCAN=true` para hacer fallar la revisión si aparece un escaneo completo.
- Gestión de pagos: `/admin/payments`.
- Informe de ventas: `/admin-analytics?period=week` o `?period=month`.
- Exportación de ventas: `/read-sales`, con filtros por fecha, estado de pago y canal, y descarga CSV para Excel, Power BI, Python o R.
- Gestión de reseñas: `/admin/reviews`.
- Seguridad de roles: `npm run seed:admin` crea el rol reservado `SuperAdmin`; para promover una cuenta `Admin` existente usa temporalmente `SUPERADMIN_EMAIL` y `npm run promote:superadmin`.
- Pedidos del cliente: `/mis-pedidos`.
- Correos de pedidos: confirmación, cambios de estado, aviso de envío y entrega se guardan en una bandeja durable y se envían mediante Brevo con reintentos automáticos.
- Sorteo de regalos: cada pedido pagado elegible recibe un número dentro de una ronda inmutable; al reiniciar se conserva el historial y se crea una ronda nueva. El ganador recibe un aviso por Brevo y el resultado público muestra el número, la fecha y el total de participaciones sin exponer datos personales.
- Participaciones administrativas: la tabla usa paginación en MongoDB y permite consultar 10, 25 o 50 filas por página sin el límite anterior de 500 registros.
- Reparto y seguimiento: el administrador asigna pedidos pagados o contra entrega a usuarios con rol `dealer`; cada repartidor ve únicamente sus entregas, confirma el efectivo al entregar y el cliente consulta una línea de tiempo desde `/mis-pedidos`.
- Permisos por rol: `SuperAdmin` es el rol reservado con todos los permisos y puede delegar o retirar ese nivel. `Admin` es el administrador operativo: conserva los módulos de la tienda, pero no `roles:manage`; las cuentas nuevas de los scripts de preparación se crean como `SuperAdmin`. Desde `/create-rol` y `/read-rol` puedes crear roles personalizados y seleccionar módulos como catálogo, pedidos, pagos, analítica, reseñas, rifa, reparto, usuarios o proveedores. Los permisos se guardan en `roledb.permisos`, se comprueban en páginas y API, y el menú oculta las opciones no autorizadas. `users:manage` no permite cambiar roles: para ello se requiere `roles:manage`, nunca se puede cambiar el rol propio y solo `SuperAdmin` puede asignar o modificar una cuenta `SuperAdmin`.

Nunca subas `.env`, `config.env`, contraseñas, claves ni `node_modules`. Las pruebas automatizadas usan datos temporales y transacciones simuladas del proveedor: completa las pruebas externas descritas en la guía antes de activar cobros reales.

El informe de ventas usa únicamente ventas pagadas y permite comparar los últimos 7 o 30 días contra el periodo anterior. Muestra ingresos, pedidos, unidades, ticket promedio, ganancia bruta estimada, margen, tendencia diaria, canales, productos y categorías con mejor resultado, productos sin rotación y alertas de inventario. La ganancia no incluye gastos de envío, comisiones de pasarela ni obligaciones tributarias.

Los nuevos importes se calculan y persisten como enteros de centavos (`totalCents`, `subtotalCents`, `precioUnitarioCents` y `precioVentaCents`). Para una base existente, ejecuta `npm run migrate:money` en modo diagnóstico y, después de respaldar y revisar el resultado, repite con `MONEY_MIGRATION_APPLY=true`.

La escritura de pedidos, ventas y detalles está centralizada en `server/business/commerceService.js`. El controlador de ventas y los detalles son de solo lectura; los endpoints antiguos de creación, edición y eliminación responden `409` y no pueden modificar inventario ni totales. Esto mantiene una única transacción para reserva, confirmación de pago, venta y sus detalles.
