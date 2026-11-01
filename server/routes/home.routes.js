const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const homePageController = require('../controller/pages/renderHomeRoutes');
const promotionsPageController = require('../controller/pages/renderPromotions');
const brandPageController = require('../controller/pages/renderBrands');
const profilePageController = require('../controller/pages/renderProfile');
const categoryPageController = require('../controller/pages/renderCategories');
const productPageController = require('../controller/pages/renderProducts');
const cartPageController = require('../controller/pages/renderCart');
const clothesPageController = require('../controller/pages/renderClothes');
const seoPageController = require('../controller/pages/renderSEO');
const rafflePageController = require('../controller/pages/renderRaffle');
const legalPageController = require('../controller/pages/renderLegal');
const categoriasMiddleware = require('../middleware/categoriasMiddleware');

router.get('/sitemap.xml', seoPageController.sitemap);
router.get('/robots.txt', seoPageController.robots);

// Solo las páginas públicas que renderizan _header.ejs reciben categorías.
// Las APIs, webhooks y vistas administrativas no pasan por el middleware.
router.get('/clothes', categoriasMiddleware, clothesPageController.renderClothes);
router.get('/', categoriasMiddleware, homePageController.homeRoutes);
router.get('/search', categoriasMiddleware, homePageController.search);
router.get('/promociones', categoriasMiddleware, promotionsPageController.promotions);
router.get('/sorteo', categoriasMiddleware, rafflePageController.publicIndex);
router.get('/privacidad', categoriasMiddleware, legalPageController.page('privacidad'));
router.get('/terminos', categoriasMiddleware, legalPageController.page('terminos'));
router.get('/cambios-devoluciones', categoriasMiddleware, legalPageController.page('cambios-devoluciones'));
router.get('/envios', categoriasMiddleware, legalPageController.page('envios'));
router.get('/reclamaciones', categoriasMiddleware, legalPageController.page('reclamaciones'));

// Alias descriptivos para enlaces antiguos o campañas que ya estén publicados.
router.get('/politica-privacidad', (req, res) => res.redirect(301, '/privacidad'));
router.get('/terminos-y-condiciones', (req, res) => res.redirect(301, '/terminos'));
router.get('/cambios-y-devoluciones', (req, res) => res.redirect(301, '/cambios-devoluciones'));
router.get('/politica-de-envios', (req, res) => res.redirect(301, '/envios'));
router.get('/pqr', (req, res) => res.redirect(301, '/reclamaciones'));
router.get('/marcas', categoriasMiddleware, brandPageController.brands);
router.get('/brand/:marca', categoriasMiddleware, brandPageController.Productbrands);
router.get('/categoria/:nombre', categoriasMiddleware, categoryPageController.category);
router.get('/Detalles/:id', categoriasMiddleware, productPageController.product_detail);

// perfil
router.get('/perfil', isLogged, categoriasMiddleware, profilePageController.profile);
router.get('/perfil/editar/:id', isLogged, categoriasMiddleware, profilePageController.update_profile_form);
router.post('/perfil/editar/:id', isLogged, profilePageController.update_profile);

router.get('/view_cart', isLogged, categoriasMiddleware, cartPageController.car);
router.get('/payment-point', isLogged, categoriasMiddleware, require('../controller/pages/renderCommerce').checkout(false));
router.get('/venta-finalizada/:id', isLogged, categoriasMiddleware, require('../controller/pages/renderCommerce').orderStatus);
router.get('/mis-pedidos', isLogged, categoriasMiddleware, require('../controller/pages/renderCommerce').myOrders);

module.exports = router;
