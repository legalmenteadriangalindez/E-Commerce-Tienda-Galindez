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
npm audit --omit=dev
```

`check` valida JavaScript, plantillas y carga de rutas. `test` omite integraciones si no hay servidor temporal. `test:integration` inicia su propio MongoDB temporal; requiere `mongod` en PATH o la variable `MONGOD_BINARY`. No utiliza tu base de desarrollo o producción.

## Producción

Lee **[PRODUCCION.md](PRODUCCION.md)** antes de desplegar. Incluye la aplicación de esta actualización, variables de Render, pruebas de pagos, imágenes, administrador inicial, pedidos anteriores, copias de seguridad y límites de la implementación.

- Configuración de Render en `render.yaml`.
- Comprobación de variables: `npm run check:production`.
- Auditoría de datos anteriores, de solo lectura: `npm run audit:data`.
- Gestión de pagos: `/admin/payments`.
- Gestión de reseñas: `/admin/reviews`.
- Pedidos del cliente: `/mis-pedidos`.

Nunca subas `.env`, `config.env`, contraseñas, claves ni `node_modules`. Las pruebas automatizadas usan datos temporales y transacciones simuladas del proveedor: completa las pruebas externas descritas en la guía antes de activar cobros reales.
