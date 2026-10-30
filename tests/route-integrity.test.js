const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const routesDirectory = path.join(root, 'server', 'routes');
const routesIndexPath = path.join(routesDirectory, 'index.js');
const adminRoutesDirectory = path.join(routesDirectory, 'admin');
const adminRouteModules = [
    'catalog.routes.js',
    'users.routes.js',
    'orders.routes.js',
    'payments.routes.js',
    'reviews.routes.js',
    'settings.routes.js',
];

function routeModuleFiles() {
    return fs
        .readdirSync(routesDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.routes.js'))
        .map((entry) => entry.name)
        .sort();
}

function routeMountPath(layer) {
    const source = layer.regexp?.source || '';
    const match = source.match(/^\^(.*?)\\\/\?\(\?=\\\/\|\$\)$/);
    return match ? match[1].replace(/\\\//g, '/') : '';
}

function collectRoutes(router, prefix = '', routes = []) {
    for (const layer of router.stack || []) {
        if (layer.route) {
            for (const method of Object.keys(layer.route.methods)) {
                if (method !== '_all') {
                    routes.push({
                        method: method.toUpperCase(),
                        path: `${prefix}${layer.route.path}`,
                    });
                }
            }
            continue;
        }

        if (layer.handle?.stack) {
            collectRoutes(layer.handle, `${prefix}${routeMountPath(layer)}`, routes);
        }
    }

    return routes;
}

function walkFiles(directory, predicate, files = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walkFiles(absolute, predicate, files);
        else if (predicate(absolute)) files.push(absolute);
    }
    return files;
}

test('todos los módulos de rutas se cargan y están montados', () => {
    const indexSource = fs.readFileSync(routesIndexPath, 'utf8');

    for (const file of routeModuleFiles()) {
        const moduleName = `./${file.slice(0, -3)}`;
        const escapedModuleName = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(
            indexSource,
            new RegExp(`require\\(['"]${escapedModuleName}['"]\\)`),
            `${file} no está montado en server/routes/index.js`
        );
        assert.doesNotThrow(() => require(path.join(routesDirectory, file)), `${file} no se puede cargar`);
    }
});

test('las rutas administrativas están divididas por dominio', () => {
    const facadePath = path.join(routesDirectory, 'admin.routes.js');
    const facadeSource = fs.readFileSync(facadePath, 'utf8');

    assert.ok(facadeSource.length < 2000, 'la fachada administrativa volvió a crecer demasiado');

    for (const moduleName of adminRouteModules) {
        const modulePath = path.join(adminRoutesDirectory, moduleName);
        assert.ok(fs.existsSync(modulePath), `${moduleName} no existe`);
        assert.match(
            facadeSource,
            new RegExp(`require\\(['"]\\./admin/${moduleName.slice(0, -3)}['"]\\)`),
            `${moduleName} no está conectado a la fachada administrativa`
        );

        const router = require(modulePath);
        assert.ok(Array.isArray(router.stack), `${moduleName} no exporta un router de Express`);
        assert.ok(router.stack.length > 0, `${moduleName} no registra rutas`);
    }
});

test('el router expone las rutas de página y API esperadas', () => {
    const router = require('../server/routes');
    const routes = collectRoutes(router);
    const has = (method, routePath) => routes.some((route) => route.method === method && route.path === routePath);

    assert.ok(routes.length > 0, 'no se encontraron rutas registradas');
    assert.ok(has('GET', '/view_cart'), 'la página activa del carrito no está registrada');
    assert.ok(has('POST', '/carrito/add'), 'la API para agregar al carrito no está registrada');
    assert.ok(has('POST', '/carrito/checkout'), 'el checkout del carrito no está registrado');
    assert.ok(has('POST', '/carrito/payment_point'), 'el pago en punto físico no está registrado');
    assert.ok(!has('GET', '/carrito'), 'no debe existir una página GET heredada /carrito');
});

test('las vistas no enlazan a la página heredada /carrito', () => {
    const viewFiles = walkFiles(path.join(root, 'views'), (filename) => filename.endsWith('.ejs'));

    for (const filename of viewFiles) {
        const source = fs.readFileSync(filename, 'utf8');
        assert.doesNotMatch(
            source,
            /(?:href|action)=["']\/carrito["']/,
            `${path.relative(root, filename)} contiene un enlace de página obsoleto`
        );
    }
});

test('cada método y ruta se registra una sola vez', () => {
    const routes = collectRoutes(require('../server/routes'));
    const seen = new Set();
    for (const route of routes) {
        const key = `${route.method} ${route.path.toLowerCase()}`;
        assert.ok(!seen.has(key), `Ruta duplicada: ${key}`);
        seen.add(key);
    }
});

test('los enlaces y acciones locales de todas las vistas tienen una ruta', () => {
    // Express compila los patrones; no dependemos de sus dependencias transitivas.
    const router = require('express').Router();
    const routes = collectRoutes(require('../server/routes')).map((route) => {
        router.get(route.path, (req, res) => res.end());
        return { ...route, pattern: router.stack.at(-1).regexp };
    });
    const missing = [];
    for (const file of walkFiles(path.join(root, 'views'), (file) => file.endsWith('.ejs'))) {
        const source = fs
            .readFileSync(file, 'utf8')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<%[\s\S]*?%>/g, 'sample');
        for (const match of source.matchAll(/<(a)\b[^>]*>|<(form)\b[^>]*>[\s\S]*?<\/form>/gi)) {
            const tag = match[0];
            const url = tag.match(/(?:href|action)=["'](\/[^"']*)["']/)?.[1];
            if (!url || url.startsWith('//') || /^\/(?:assets|css|js|img|uploads)\//.test(url)) continue;
            const target = new URL(url.replace(/&amp;/g, '&'), 'http://localhost');
            let method =
                match[1]?.toLowerCase() === 'a'
                    ? 'GET'
                    : (tag.match(/method=["']([^"']*)["']/i)?.[1] || 'GET').toUpperCase();
            if (method === 'POST' && target.searchParams.has('_method'))
                method = target.searchParams.get('_method').toUpperCase();
            if (method === 'POST') {
                const override = tag.match(
                    /<input\b[^>]*name=["']_method["'][^>]*value=["'](PUT|PATCH|DELETE)["']/i
                )?.[1];
                if (override) method = override.toUpperCase();
            }
            if (!routes.some((route) => route.method === method && route.pattern.test(target.pathname)))
                missing.push(`${path.relative(root, file)} -> ${method} ${target.pathname}`);
        }
    }
    assert.deepEqual(missing, []);
});

test('los módulos eliminados no vuelven a introducir exports heredados', () => {
    assert.equal(fs.existsSync(path.join(root, 'server/services/renderCheckout.js')), false);

    const renderCart = fs.readFileSync(path.join(root, 'server/pages/renderCart.js'), 'utf8');
    const renderSales = fs.readFileSync(path.join(root, 'server/pages/renderSales.js'), 'utf8');
    const saleController = fs.readFileSync(path.join(root, 'server/controller/saleController.js'), 'utf8');

    assert.doesNotMatch(
        renderCart,
        /exports\.(billing_point|payment_point|payment_point_admin|add_to_carrito|order_success)\s*=/
    );
    assert.doesNotMatch(renderSales, /exports\.(create_sale_form|view_sale|total_profit)\s*=/);
    assert.doesNotMatch(saleController, /exports\.confirmacion\s*=/);
});
