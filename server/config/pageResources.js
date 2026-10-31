const css = (...names) => names.map((name) => `/css/${name}`);
const js = (...names) => names.map((name) => `/js/${name}`);

const checkoutStyles = () =>
    css(
        'pages/checkout/layout.css',
        'pages/checkout/form.css',
        'pages/checkout/payment-methods.css',
        'pages/checkout/summary.css',
        'pages/checkout/responsive.css'
    );
const pointOfSaleStyles = () => [...checkoutStyles(), ...css('add-product-billing-point.css')];

// Recursos propios de cada vista. Los estilos base de navegación, tema y pie
// se cargan en los encabezados; todo lo demás se declara aquí para no enviar
// CSS o JavaScript de otros módulos al navegador.
const resources = {
    'client/home/index': {
        pageCss: css(
            'carousel.css',
            'cards.css',
            'pagination.css',
            'components/buttons.css',
            'nequi.css',
            'whatsapp.css'
        ),
        pageJs: js('Add_to_cart_client_nav.js'),
    },
    'client/categories/categories': {
        pageCss: css('categories.css', 'cards.css', 'pagination.css', 'components/buttons.css'),
        pageJs: js('Add_to_cart_client_nav.js'),
    },
    'client/products/search_products': {
        pageCss: css('cards.css', 'pagination.css', 'components/buttons.css'),
        pageJs: js('Add_to_cart_client_nav.js'),
    },
    'client/products/Product_brands': {
        pageCss: css('cards.css', 'pagination.css', 'components/buttons.css'),
        pageJs: js('Add_to_cart_client_nav.js'),
    },
    'client/promotions/promotions': {
        pageCss: css('cards.css', 'pagination.css', 'components/buttons.css'),
        pageJs: js('Add_to_cart_client_nav.js'),
    },
    'client/brands/brands': {
        pageCss: css('brand-cards.css', 'components/buttons.css'),
    },
    'client/clothes/clothes': {
        pageCss: css(
            'pages/clothes/landing.css',
            'pages/clothes/catalog.css',
            'pages/clothes/catalog-responsive.css',
            'pages/clothes/landing-responsive.css',
            'pagination.css'
        ),
        pageJs: js('Add_to_cart_client_nav.js', 'clothes.js'),
    },
    'client/products/product_detail': {
        pageCss: css('carousel.css', 'components/product-info.css', 'components/reviews.css', 'components/buttons.css'),
        pageJs: js('Add_to_cart_client_nav.js', 'product-reviews.js'),
    },
    'client/cart/cart': {
        pageCss: css(
            'pages/cart/layout.css',
            'pages/cart/items.css',
            'pages/cart/summary.css',
            'pages/cart/responsive.css',
            'pages/cart/pantry-layout.css',
            'pages/cart/pantry-items.css',
            'pages/cart/pantry-summary.css',
            'pages/cart/pantry-responsive.css',
            'pages/cart/add-products.css'
        ),
        pageJs: js('cart/cartView.js', 'cart/cartApi.js', 'client_cart.js'),
    },
    'client/profile/profile': { pageCss: css('profile.css') },
    'client/profile/Edit_profile': { pageCss: css('pages/edit-profile.css') },
    'client/payment/payment_point': { pageCss: checkoutStyles() },
    'client/payment/orders': { pageCss: css('commerce.css') },
    'client/payment/order_status': { pageCss: css('commerce.css', 'delivery-tracking.css') },
    'client/raffle/index': { pageCss: css('commerce.css', 'pages/raffle/public.css') },
    'client/legal/page': { pageCss: css('legal.css') },
    'client/auth/forgot_password': { pageCss: css('commerce.css') },
    'client/auth/reset_password': {
        pageCss: css('commerce.css', 'components/password-visibility.css'),
        pageJs: js('password-visibility.js'),
    },

    'admin/home/Billing_point': {
        pageCss: pointOfSaleStyles(),
        pageJs: js(
            'point-of-sale/pointOfSaleApi.js',
            'point-of-sale/pointOfSaleView.js',
            'AdminPaymentPoint.js',
            'commerce-ui.js'
        ),
    },
    'admin/payment/payment_point': { pageCss: checkoutStyles() },
    'admin/payment/checkout_confirmation': { pageCss: checkoutStyles() },
    'admin/payment/manage': { pageCss: css('commerce.css', 'admin-pagination.css') },
    'admin/analytics/index': { pageCss: css('pages/analytics/dashboard.css', 'pages/analytics/responsive.css') },
    'admin/analytics/stock': { pageCss: css('pages/stock.css', 'admin-pagination.css') },
    'admin/analytics/profit_margins': { pageCss: css('profit_margins.css') },
    'admin/analytics/best_selling_products': { pageCss: css('best_selling_products.css') },
    'admin/orders/read_orders': { pageCss: css('pages/read-orders.css', 'admin-pagination.css') },
    'admin/orders/detail_orders': { pageCss: css('detail_order.css', 'delivery-tracking.css') },
    'admin/orders/update_order': { pageCss: css('update_order.css') },
    'admin/delivery/index': { pageCss: css('admin-delivery.css', 'admin-pagination.css') },
    'admin/raffle/manage': { pageCss: css('commerce.css', 'pages/raffle/admin.css', 'admin-pagination.css') },
    'admin/reviews/read_reviews': {
        pageCss: css(
            'pages/admin-reviews/layout.css',
            'pages/admin-reviews/filters.css',
            'pages/admin-reviews/cards.css',
            'pages/admin-reviews/responsive.css'
        ),
        pageJs: js('admin-reviews.js'),
    },
    'admin/settings/shipping': { pageCss: css('admin-settings.css') },
    'admin/sales/read_sales': {
        pageCss: css('pages/sales/table.css', 'pages/sales/export.css', 'admin-pagination.css'),
    },
    'admin/sales/read_detailsSales': { pageCss: css('read_detailsSales.css') },
    'admin/products/read_products': { pageCss: css('read_products.css', 'admin-pagination.css') },
    'admin/products/create_producto': { pageCss: css('pages/create-products.css') },
    'admin/products/update_products': { pageCss: css('edit_products.css') },
    'admin/categories/read_categories': { pageCss: css('read_categories.css', 'admin-pagination.css') },
    'admin/categories/create_categoria': { pageCss: css('create_categories.css') },
    'admin/categories/update_category': { pageCss: css('update_categories.css') },
    'admin/brands/read_brands': { pageCss: css('read_brands.css', 'admin-pagination.css') },
    'admin/brands/create_marca': { pageCss: css('create_brands.css') },
    'admin/brands/update_brands': { pageCss: css('update_brands.css') },
    'admin/providers/read_providers': { pageCss: css('read_providers.css', 'admin-pagination.css') },
    'admin/providers/create_proveedor': { pageCss: css('create_providers.css') },
    'admin/providers/update_provider': { pageCss: css('update_providers.css') },
    'admin/users/read_users': { pageCss: css('read_users.css', 'admin-pagination.css') },
    'admin/users/add_user': {
        pageCss: css('create_users.css', 'components/password-visibility.css'),
        pageJs: js('password-visibility.js'),
    },
    'admin/users/update_user': { pageCss: css('update_users.css') },
    'admin/rols/read_rols': { pageCss: css('read_rols.css', 'admin-pagination.css') },
    'admin/rols/create_rol': { pageCss: css('create_roles.css') },
    'admin/rols/update_roles': { pageCss: css('update_roles.css') },
    'admin/profile/profile': { pageCss: css('profile.css') },
    'admin/profile/Edit_profile': { pageCss: css('pages/edit-profile.css') },
    'dealer/orders/read_orders': { pageCss: css('dealer_read_orders.css', 'admin-pagination.css') },
    'dealer/orders/detail_orders': {
        pageCss: css('dealer_detail_order.css', 'detail_order.css', 'delivery-tracking.css'),
    },
    'dealer/orders/update_order': {
        pageCss: css('dealer_update_orders.css', 'delivery-tracking.css'),
    },
    'dealer/profile/profile': { pageCss: css('profile.css') },
    'dealer/profile/Edit_profile': { pageCss: css('pages/edit-profile.css') },
};

function pageResourcesFor(view) {
    const key = String(view).replace(/\.ejs$/, '');
    const selected = resources[key] || {};
    return {
        pageCss: [...(selected.pageCss || [])],
        pageJs: [...(selected.pageJs || [])],
    };
}

module.exports = { pageResourcesFor, resources };
