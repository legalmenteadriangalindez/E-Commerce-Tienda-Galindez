const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const directCatalogViews = [
    '../server/pages/renderHomeRoutes.js',
    '../server/pages/renderClothes.js',
    '../server/pages/renderPromotions.js',
    '../server/pages/renderSEO.js',
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
    const view = fs.readFileSync(path.join(__dirname, '../server/pages/renderHomeRoutes.js'), 'utf8');
    assert.match(controller, /require\('\.\.\/business\/catalogService'\)/);
    assert.match(view, /require\('\.\.\/business\/catalogService'\)/);
});
