'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(root, 'views/admin/products/update_products.ejs'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/css/edit_products.css'), 'utf8');

function imagesHtml(fotos) {
    const start = view.indexOf('<div class="image-section">');
    const end = view.indexOf('<div class="form-actions">', start);
    assert.ok(start > 0 && end > start, 'la sección de imágenes debe permanecer dentro del formulario');
    return ejs.render(view.slice(start, end), { producto: { nombre: 'Café & accesorios', fotos } });
}

test('una sola imagen tiene su propia miniatura y no pierde los controles', () => {
    const html = imagesHtml(['/foto-1.webp']);
    assert.match(html, /Imagen 1 de 1/);
    assert.match(html, /class="image-card__preview"/);
    assert.match(html, /alt="Foto 1 del producto Café &amp; accesorios"/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, /id="product-image-replace-0"/);
    assert.match(html, /for="product-image-replace-0"/);
    assert.match(html, /name="foto_0"/);
    assert.match(html, /id="product-image-remove-0"/);
    assert.match(html, /for="product-image-remove-0"/);
    assert.match(html, /name="eliminarFotos"/);
    assert.match(html, /value="\/foto-1\.webp"/);
    assert.match(html, /name="nuevasFotos"/);
    assert.match(html, /multiple/);
    assert.doesNotMatch(html, /name="foto_1"/);
});

test('cada imagen conserva el índice de reemplazo y su valor de eliminación', () => {
    const fotos = ['/uno.webp', '/dos.webp', '/tres.webp', '/cuatro.webp'];
    const html = imagesHtml(fotos);

    assert.equal((html.match(/class="image-card"/g) || []).length, fotos.length);
    assert.equal((html.match(/name="eliminarFotos"/g) || []).length, fotos.length);
    assert.equal((html.match(/name="nuevasFotos"/g) || []).length, 1);

    for (const [index, foto] of fotos.entries()) {
        assert.ok(html.includes('name="foto_' + index + '"'));
        assert.ok(html.includes('id="product-image-replace-' + index + '"'));
        assert.ok(html.includes('id="product-image-remove-' + index + '"'));
        assert.ok(html.includes('value="' + foto + '"'));
    }
});

test('un producto sin fotos permite cargar nuevas imágenes sin controles de eliminación', () => {
    const html = imagesHtml([]);
    assert.match(html, /Sin imágenes registradas/);
    assert.match(html, /name="nuevasFotos"/);
    assert.doesNotMatch(html, /name="eliminarFotos"/);
    assert.doesNotMatch(html, /name="foto_0"/);
});

test('el formulario de edición conserva endpoint, protección CSRF y opciones de fotografías', () => {
    assert.match(view, /action="\/api\/productos\/<%= producto\._id %>\?_method=PUT"/);
    assert.match(view, /method="POST"/);
    assert.match(view, /enctype="multipart\/form-data"/);
    assert.match(view, /name="_csrf"/);
    assert.equal((view.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length, 2);
});

test('las imágenes no se expanden ni se recortan, y los controles caben en móvil', () => {
    assert.match(styles, /\.image-grid\s*\{[^}]*display:\s*flex;/);
    assert.match(styles, /\.image-grid\s*\{[^}]*flex-wrap:\s*wrap;/);
    assert.match(styles, /\.image-grid\s*\{[^}]*justify-content:\s*center;/);
    assert.match(styles, /\.image-card\s*\{[^}]*flex:\s*0 1 220px;/);
    assert.match(styles, /\.image-card__preview\s*\{[^}]*height:\s*170px;/);
    assert.match(styles, /\.image-card__preview img\s*\{[^}]*object-fit:\s*contain;/);
    assert.match(styles, /\.image-actions input\[type='file'\]/);
    assert.match(styles, /\.upload-new input\[type='file'\]/);
    assert.doesNotMatch(styles, /grid-template-columns:\s*repeat\(auto-fit/);
});
