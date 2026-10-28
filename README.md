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

Los pagos están desactivados inicialmente. Para probarlos, configura las cuatro claves de Wompi sandbox y `PAYMENTS_ENABLED=true`.

## Validación

```text
npm run check
npm test
npm run test:integration
npm run maintenance
npm audit --omit=dev
```

`check` valida JavaScript, plantillas y carga de rutas. `test` omite integraciones si no hay servidor temporal. `test:integration` inicia su propio MongoDB temporal; requiere `mongod` en PATH o la variable `MONGOD_BINARY`. No utiliza tu base de desarrollo o producción.

El proceso web no ejecuta tareas periódicas. En Render, `render.yaml` define el Cron Job `tienda-galindez-maintenance`, que ejecuta `npm run maintenance` cada minuto. En local puedes ejecutarlo manualmente después de configurar `MONGO_URI`.

Las vistas públicas de catálogo consultan directamente `server/business/catalogService.js`, que también utiliza la API pública. No hacen peticiones Axios al propio dominio ni dependen de `BASE_URL` para cargar productos; `BASE_URL` se reserva para enlaces públicos, SEO e integraciones externas.

## Producción

Lee **[PRODUCCION.md](PRODUCCION.md)** antes de desplegar. Incluye la aplicación de esta actualización, variables de Render, pruebas de pagos, imágenes, administrador inicial, pedidos anteriores, copias de seguridad y límites de la implementación.

- Configuración de Render en `render.yaml`.
- Comprobación de variables: `npm run check:production`.
- Auditoría de datos anteriores, de solo lectura: `npm run audit:data`.
- Revisión de planes MongoDB: `npm run explain:queries` con `MONGO_URI` apuntando a una base de desarrollo o a una copia de producción. El informe usa `executionStats` para las analíticas y listados administrativos; activa `EXPLAIN_FAIL_ON_COLLSCAN=true` para hacer fallar la revisión si aparece un escaneo completo.
- Gestión de pagos: `/admin/payments`.
- Informe de ventas: `/admin-analytics?period=week` o `?period=month`.
- Exportación de ventas: `/read-sales`, con filtros por fecha, estado de pago y canal, y descarga CSV para Excel, Power BI, Python o R.
- Gestión de reseñas: `/admin/reviews`.
- Pedidos del cliente: `/mis-pedidos`.
- Correos de pedidos: confirmación, cambios de estado, aviso de envío y entrega se guardan en una bandeja durable y se envían mediante Brevo con reintentos automáticos.
- Sorteo de regalos: cada pedido pagado elegible recibe un número; el ganador recibe un aviso por Brevo y el resultado público muestra el número, la fecha y el total de participaciones sin exponer datos personales.
- Participaciones administrativas: la tabla usa paginación en MongoDB y permite consultar 10, 25 o 50 filas por página sin el límite anterior de 500 registros.
- Reparto y seguimiento: el administrador asigna pedidos pagados a usuarios con rol `dealer`; cada repartidor ve únicamente sus entregas y el cliente consulta una línea de tiempo desde `/mis-pedidos`.
- Permisos por rol: `Admin` conserva acceso de superadministrador por compatibilidad. Desde `/create-rol` y `/read-rol` puedes crear roles personalizados y seleccionar módulos como catálogo, pedidos, pagos, analítica, reseñas, rifa, reparto, usuarios o proveedores. Los permisos se guardan en `roledb.permisos`, se comprueban en páginas y API, y el menú oculta las opciones no autorizadas. Para aplicar un rol a una cuenta, edítala desde `/read-user` y selecciona el rol; las cuentas existentes se actualizan al siguiente acceso sin migración manual.

Nunca subas `.env`, `config.env`, contraseñas, claves ni `node_modules`. Las pruebas automatizadas usan datos temporales y transacciones simuladas del proveedor: completa las pruebas externas descritas en la guía antes de activar cobros reales.

El informe de ventas usa únicamente ventas pagadas y permite comparar los últimos 7 o 30 días contra el periodo anterior. Muestra ingresos, pedidos, unidades, ticket promedio, ganancia bruta estimada, margen, tendencia diaria, canales, productos y categorías con mejor resultado, productos sin rotación y alertas de inventario. La ganancia no incluye gastos de envío, comisiones de pasarela ni obligaciones tributarias.

Los nuevos importes se calculan y persisten como enteros de centavos (`totalCents`, `subtotalCents`, `precioUnitarioCents` y `precioVentaCents`). Para una base existente, ejecuta `npm run migrate:money` en modo diagnóstico y, después de respaldar y revisar el resultado, repite con `MONEY_MIGRATION_APPLY=true`.

La escritura de pedidos, ventas y detalles está centralizada en `server/business/commerceService.js`. El controlador de ventas y los detalles son de solo lectura; los endpoints antiguos de creación, edición y eliminación responden `409` y no pueden modificar inventario ni totales. Esto mantiene una única transacción para reserva, confirmación de pago, venta y sus detalles.

