'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const createView = read('views/admin/brands/create_marca.ejs');
const updateView = read('views/admin/brands/update_brands.ejs');
const createStyles = read('public/css/create_brands.css');
const updateStyles = read('public/css/update_brands.css');

test('la creación de marcas conserva el contrato del formulario y usa una tarjeta propia', () => {
    assert.match(createView, /action="\/api\/marcas"/);
    assert.match(createView, /method="POST"/);
    assert.match(createView, /enctype="multipart\/form-data"/);
    assert.match(createView, /name="_csrf"/);
    assert.match(createView, /name="nombre"/);
    assert.match(createView, /name="foto"/);
    assert.match(createView, /class="admin-brand-form brand-form"/);
    assert.match(createView, /id="brand-photo"/);
});

test('la edición de marcas tiene un solo título y conserva los campos originales', () => {
    assert.equal((updateView.match(/<h1[\s\S]*?<\/h1>/g) || []).length, 1);
    assert.equal((updateView.match(/Editar marca/g) || []).length, 1);
    assert.doesNotMatch(updateView, /<br\s*\/?>/i);
    assert.match(updateView, /action="\/update-marca\/<%= brand\._id %>"/);
    assert.match(updateView, /name="_csrf"/);
    assert.match(updateView, /name="nombre"/);
    assert.match(updateView, /name="foto"/);
    assert.match(updateView, /class="brand-image-preview"/);
    assert.match(updateView, /loading="lazy"/);
    assert.match(updateView, /decoding="async"/);
});

test('ambas hojas centran la tarjeta y limitan la vista previa', () => {
    for (const source of [createStyles, updateStyles]) {
        assert.match(source, /\.admin-brand-form\s*\{[^}]*max-width:\s*650px;/);
        assert.match(source, /\.admin-brand-form\s*\{[^}]*margin:\s*0 auto 40px;/);
        assert.match(source, /\.brand-file-picker\s*\{/);
        assert.match(source, /\.brand-form__file-input::file-selector-button/);
    }

    assert.match(updateStyles, /\.brand-image-preview img\s*\{[^}]*width:\s*240px;/);
    assert.match(updateStyles, /\.brand-image-preview img\s*\{[^}]*height:\s*180px;/);
    assert.match(updateStyles, /object-fit:\s*contain;/);
    assert.match(updateStyles, /@media \(max-width: 480px\)/);
});
