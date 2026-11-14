'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => {
    const actualPath = path.join(root, relativePath);
    const stagingPath = path.join(root, '.phase8', path.basename(relativePath));
    const fallback = path.join(root, '.phase8', relativePath);
    const sourcePath = fs.existsSync(actualPath)
        ? actualPath
        : fs.existsSync(fallback)
          ? fallback
          : stagingPath;
    return fs.readFileSync(sourcePath, 'utf8');
};

const productView = read('views/client/products/product_detail.ejs');
const productStyles = read('public/css/pages/product-detail.css');
const pageResources = read('server/config/pageResources.js');

test('el detalle público contiene la cuadrícula dentro de un contenedor con gutter', () => {
    assert.match(productView, /<main class="product-detail-page">/);
    assert.match(productView, /<div class="row">/);
    assert.match(productView, /include\('\.\/partials\/product-carousel'/);
    assert.match(productView, /include\('\.\/partials\/product-info'/);
});

test('el layout del detalle neutraliza el desbordamiento de Bootstrap sin tocar sus columnas', () => {
    assert.match(productStyles, /\.product-detail-page\s*\{/);
    assert.match(productStyles, /width:\s*100%;/);
    assert.match(productStyles, /padding-inline:\s*var\(--bs-gutter-x,\s*0\.75rem\);/);
    assert.doesNotMatch(productStyles, /^\.row\s*\{/m);
});

test('la hoja del detalle está registrada como recurso exclusivo de la vista', () => {
    assert.match(
        pageResources,
        /'client\/products\/product_detail':\s*\{[\s\S]*?'pages\/product-detail\.css'/
    );
});
