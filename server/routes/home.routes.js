const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const servicesRenderHomeRutes = require('../services/renderHomeRoutes');
const servicesRenderPromotions = require('../services/renderPromotions');
const servicesRenderBrand = require('../services/renderBrands');
const servicesRenderProfile = require('../services/renderProfile');
const servicesRenderCategory = require('../services/renderCategories');
const servicesRenderProduct = require('../services/renderProducts');
const servicesRenderCart = require('../services/renderCart');
const clotehsService = require('../services/renderClothes');
const servicesRenderSEO = require('../services/renderSEO');
const servicesRenderRaffle = require('../services/renderRaffle');
const servicesRenderLegal = require('../services/renderLegal');
const categoriasMiddleware = require('../middleware/categoriasMiddleware');

router.get('/sitemap.xml', servicesRenderSEO.sitemap);
router.get('/robots.txt', servicesRenderSEO.robots);

// Solo las páginas públicas que renderizan _header.ejs reciben categorías.
// Las APIs, webhooks y vistas administrativas no pasan por el middleware.
router.get('/clothes', categoriasMiddleware, clotehsService.renderClothes);
router.get('/', categoriasMiddleware, servicesRenderHomeRutes.homeRoutes);
router.get('/search', categoriasMiddleware, servicesRenderHomeRutes.search);
router.get('/promociones', categoriasMiddleware, servicesRenderPromotions.promotions);
router.get('/sorteo', categoriasMiddleware, servicesRenderRaffle.publicIndex);
router.get('/privacidad', categoriasMiddleware, servicesRenderLegal.page('privacidad'));
router.get('/terminos', categoriasMiddleware, servicesRenderLegal.page('terminos'));
router.get('/cambios-devoluciones', categoriasMiddleware, servicesRenderLegal.page('cambios-devoluciones'));
router.get('/envios', categoriasMiddleware, servicesRenderLegal.page('envios'));
router.get('/reclamaciones', categoriasMiddleware, servicesRenderLegal.page('reclamaciones'));

// Alias descriptivos para enlaces antiguos o campañas que ya estén publicados.
router.get('/politica-privacidad', (req, res) => res.redirect(301, '/privacidad'));
router.get('/terminos-y-condiciones', (req, res) => res.redirect(301, '/terminos'));
router.get('/cambios-y-devoluciones', (req, res) => res.redirect(301, '/cambios-devoluciones'));
router.get('/politica-de-envios', (req, res) => res.redirect(301, '/envios'));
router.get('/pqr', (req, res) => res.redirect(301, '/reclamaciones'));
router.get('/marcas', categoriasMiddleware, servicesRenderBrand.brands);
router.get('/brand/:marca', categoriasMiddleware, servicesRenderBrand.Productbrands);
router.get('/categoria/:nombre', categoriasMiddleware, servicesRenderCategory.category);
router.get('/Detalles/:id', categoriasMiddleware, servicesRenderProduct.product_detail);

// perfil
router.get('/perfil', isLogged, categoriasMiddleware, servicesRenderProfile.profile);
router.get('/perfil/editar/:id', isLogged, categoriasMiddleware, servicesRenderProfile.update_profile_form);
router.post("/perfil/editar/:id",isLogged,servicesRenderProfile.update_profile);

router.get('/view_cart', isLogged, categoriasMiddleware, servicesRenderCart.car);
router.get('/payment-point', isLogged, categoriasMiddleware, require('../services/renderCommerce').checkout(false));
router.get('/venta-finalizada/:id', isLogged, categoriasMiddleware, require('../services/renderCommerce').orderStatus);
router.get('/mis-pedidos', isLogged, categoriasMiddleware, require('../services/renderCommerce').myOrders);

module.exports = router;
