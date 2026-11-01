const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const directCatalogViews = [
    '../server/controller/pages/renderHomeRoutes.js',
    '../server/controller/pages/renderClothes.js',
    '../server/controller/pages/renderPromotions.js',
    '../server/controller/pages/renderSEO.js',
];

test('las vistas públicas de catálogo no llaman por HTTP a la propia API', () => {
    for (const relativePath of directCatalogViews) {
        const filename = path.join(__dirname, relativePath);
        const source = fs.readFileSync(filename, 'utf8');
        assert.doesNotMatch(source, /require\(['"]axios['"]\)/, filename);
        assert.doesNotMatch(source, /\/api\/productos\/catalogo/, filename);
    }
});

test('el controlador y las vistas comparten el servicio de catálogo', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../server/controller/productController.js'), 'utf8');
    const pageController = fs.readFileSync(
        path.join(__dirname, '../server/controller/pages/renderHomeRoutes.js'),
        'utf8'
    );
    assert.match(controller, /require\('\.\.\/business\/catalogService'\)/);
    assert.match(pageController, /require\('\.\.\/\.\.\/business\/catalogService'\)/);
});
