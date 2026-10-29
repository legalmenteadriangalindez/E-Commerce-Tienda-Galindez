const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const servicesRenderHomeRutes = require('../pages/renderHomeRoutes');
const servicesRenderPromotions = require('../pages/renderPromotions');
const servicesRenderBrand = require('../pages/renderBrands');
const servicesRenderProfile = require('../pages/renderProfile');
const servicesRenderCategory = require('../pages/renderCategories');
const servicesRenderProduct = require('../pages/renderProducts');
const servicesRenderCart = require('../pages/renderCart');
const clotehsService = require('../pages/renderClothes');
const servicesRenderSEO = require('../pages/renderSEO');
const servicesRenderRaffle = require('../pages/renderRaffle');
const servicesRenderLegal = require('../pages/renderLegal');
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
router.post('/perfil/editar/:id', isLogged, servicesRenderProfile.update_profile);

router.get('/view_cart', isLogged, categoriasMiddleware, servicesRenderCart.car);
router.get('/payment-point', isLogged, categoriasMiddleware, require('../pages/renderCommerce').checkout(false));
router.get('/venta-finalizada/:id', isLogged, categoriasMiddleware, require('../pages/renderCommerce').orderStatus);
router.get('/mis-pedidos', isLogged, categoriasMiddleware, require('../pages/renderCommerce').myOrders);

module.exports = router;
