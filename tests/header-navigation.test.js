const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const template = fs.readFileSync(
    path.join(__dirname, '../views/include/_header.ejs'),
    'utf8'
);

function render(sessionUser = null) {
    return ejs.render(template, {
        categorias: [],
        cart: [],
        csrfToken: 'csrf-test',
        cspNonce: 'nonce-test',
        sessionUser,
        activeRaffle: null
    });
}

test('el menú de perfil ofrece autenticación cuando no hay sesión', () => {
    const html = render();

    assert.match(html, /href="\/login"/);
    assert.match(html, /href="\/register"/);
    assert.doesNotMatch(html, /href="\/perfil"/);
    assert.doesNotMatch(html, /href="\/mis-pedidos"/);
    assert.doesNotMatch(html, /Cerrar sesión/);
});

test('el menú de perfil muestra las acciones de la cuenta autenticada', () => {
    const html = render({ _id: 'cliente-1', nombre: 'Cliente' });

    assert.match(html, /href="\/perfil"/);
    assert.match(html, /href="\/mis-pedidos"/);
    assert.match(html, /Cerrar sesión/);
    assert.doesNotMatch(html, /Crear cuenta/);
});
