'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name, stagingName = name) => {
    const actualPath = path.join(root, name);
    const stagingPath = path.join(root, '.phase6', stagingName);
    return fs.readFileSync(fs.existsSync(actualPath) ? actualPath : stagingPath, 'utf8');
};

const catalogStyles = [
    'create_categories.css',
    'update_categories.css',
    'create_roles.css',
    'update_roles.css',
    'create_providers.css',
    'update_providers.css',
].map((file) => read(`public/css/${file}`, file));

const brandStyles = ['create_brands.css', 'update_brands.css'].map((file) => read(`public/css/${file}`, file));

const catalogBase = read('public/css/pages/admin-catalog-forms.css', 'admin-catalog-forms.css');
const brandBase = read('public/css/pages/admin-brand-forms.css', 'admin-brand-forms.css');

test('las seis hojas de catálogo delegan su base visual a una sola hoja compartida', () => {
    catalogStyles.forEach((source) => {
        assert.equal((source.match(/@import url\('\/css\/pages\/admin-catalog-forms\.css'\);/g) || []).length, 1);
        assert.doesNotMatch(source, /\.permission-grid\s*\{/);
        assert.doesNotMatch(source, /\.provider-form \.form-grid\s*\{/);
    });

    assert.match(catalogBase, /\.permission-grid\s*\{/);
    assert.match(catalogBase, /\.provider-form \.form-grid\s*\{/);
    assert.match(catalogBase, /\.category-form \.form-actions/);
    assert.match(catalogBase, /\.role-form \.form-actions/);
    assert.match(catalogBase, /\.provider-form \.form-actions/);
});

test('las hojas de marcas comparten la tarjeta y conservan únicamente sus variantes', () => {
    brandStyles.forEach((source) => {
        assert.equal((source.match(/@import url\('\/css\/pages\/admin-brand-forms\.css'\);/g) || []).length, 1);
        assert.doesNotMatch(source, /\.admin-brand-form\s*\{/);
        assert.doesNotMatch(source, /\.brand-file-picker\s*\{/);
    });

    assert.match(brandBase, /\.admin-brand-form\s*\{/);
    assert.match(brandBase, /\.brand-file-picker\s*\{/);
    assert.match(brandBase, /\.brand-form__submit\s*\{/);
    assert.match(brandBase, /@media \(max-width: 768px\)/);
    assert.match(brandBase, /@media \(max-width: 480px\)/);
});

test('las bases compartidas mantienen los puntos de adaptación y los anchos de lectura', () => {
    assert.match(catalogBase, /@media \(max-width: 620px\)/);
    assert.match(catalogBase, /@media \(max-width: 680px\)/);
    assert.match(catalogBase, /@media \(max-width: 600px\)/);
    assert.match(catalogStyles[0], /max-width: 700px/);
    assert.match(catalogStyles[2], /max-width: 900px/);
    assert.match(catalogStyles[4], /max-width: 900px/);
    assert.match(brandBase, /max-width: 650px/);
});
