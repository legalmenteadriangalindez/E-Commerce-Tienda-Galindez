const express = require('express');

const router = express.Router();

// La fachada conserva el montaje histórico en `server/routes/index.js`.
// Cada submódulo registra sus propias rutas sin cambiar las URL públicas.
router.use('/', require('./admin/reviews.routes'));
router.use('/', require('./admin/payments.routes'));
router.use('/', require('./admin/catalog.routes'));
router.use('/', require('./admin/orders.routes'));
router.use('/', require('./admin/users.routes'));
router.use('/', require('./admin/settings.routes'));

module.exports = router;
