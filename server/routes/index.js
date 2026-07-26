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

router.use('/api/roles', require('./roles.routes'));
router.use('/carrito', require('./cart.routes'));
router.use('/', require('./admin.routes'));

router.use('/dealer', require('./dealer.routes'));                   
router.get('/clothes', require('./clothes.routes'));

router.get('/reset-cart', (req, res) => {

    req.session.cart = [];

    res.send('Carrito reseteado');

});

module.exports = router;