const express = require('express');
const router = express.Router();

router.use('/', require('./home.routes'));
router.use('/', require('./auth.routes'));

router.use('/api/users', require('./user.routes'));
router.use('/api/productos', require('./product.routes'));
router.use('/api/categorias', require('./category.routes'));
router.use('/api/marcas', require('./brand.routes'));
router.use('/api/proveedores', require('./provider.routes'));
router.use('/api/ventas', require('./sales.routes'));
router.use('/api/orders', require('./order.routes'));
router.use('/api/reviews', require('./review.routes'));
router.use('/api/admin/reviews', require('./adminReview.routes'));

router.use('/api/roles', require('./roles.routes'));
router.use('/carrito', require('./cart.routes'));
router.use('/', require('./admin.routes'));

router.use('/dealer', require('./dealer.routes'));                   


router.post('/reset-cart', (req, res) => {

    req.session.cart = [];
    delete req.session.claveCheckout;
    delete req.session.claveIdempotenciaCaja;
    req.session.save(error => error ? res.status(503).json({ message: 'No se pudo guardar el carrito' }) : res.json({ success: true }));

});

module.exports = router;
