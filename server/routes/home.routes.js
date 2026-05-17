const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const servicesRenderHomeRutes = require('../services/renderHomeRoutes');
const servicesRenderPromotions = require('../services/renderPromotions');
const servicesRenderBrand = require('../services/renderBrands');
const servicesRenderProfile = require('../services/renderProfile');
const servicesRenderCategory = require('../services/renderCategories');
const servicesRenderProduct = require('../services/renderProducts');
const renderCart = require('../services/renderCart');

router.get('/', servicesRenderHomeRutes.homeRoutes);
router.get('/search', servicesRenderHomeRutes.search);
router.get('/promociones', servicesRenderPromotions.promotions);
router.get('/marcas', servicesRenderBrand.brands);
router.get('/brand/:marca', servicesRenderBrand.Productbrands);
router.get('/categoria/:nombre', servicesRenderCategory.category);
router.get('/Detalles/:id',  servicesRenderProduct.product_detail);

// perfil
router.get('/perfil', servicesRenderProfile.profile);
router.get('/perfil/editar/:id', servicesRenderProfile.update_profile_form);
router.post('/perfil/editar/:id', servicesRenderProfile.update_profile);



module.exports = router;