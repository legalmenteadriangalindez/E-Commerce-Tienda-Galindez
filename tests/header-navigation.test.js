const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const template = fs.readFileSync(path.join(__dirname, '../views/include/_header.ejs'), 'utf8');

function render(sessionUser = null) {
    return ejs.render(
        template,
        {
            categorias: [],
            cart: [],
            csrfToken: 'csrf-test',
            cspNonce: 'nonce-test',
            sessionUser,
            activeRaffle: null,
        },
        { filename: path.join(__dirname, '../views/include/_header.ejs') }
    );
}

test('el menú de perfil ofrece autenticación cuando no hay sesión', () => {
    const html = render();

    assert.match(html, /href="\/login"/);
    assert.match(html, /href="\/register"/);
    assert.doesNotMatch(html, /href="\/perfil"/);
    assert.doesNotMatch(html, /href="\/mis-pedidos"/);
    assert.doesNotMatch(html, /href="\/change-password"/);
    assert.doesNotMatch(html, /Cerrar sesión/);
});

test('el menú de perfil muestra las acciones de la cuenta autenticada', () => {
    const html = render({ _id: 'cliente-1', nombre: 'Cliente' });

    assert.match(html, /href="\/perfil"/);
    assert.match(html, /href="\/mis-pedidos"/);
    assert.match(html, /href="\/change-password"/);
    assert.match(html, /Cerrar sesión/);
    assert.doesNotMatch(html, /Crear cuenta/);
});

test('la navegación pública ofrece controles con nombre y destinos para teclado', () => {
    const html = render();
    const anchors = [...html.matchAll(/<a\b[^>]*>/gs)].map(([tag]) => tag);
    const dropdownButtons = [...html.matchAll(/<button\b[^>]*data-bs-toggle="dropdown"[^>]*>/gs)];

    assert.ok(anchors.length > 0);
    assert.ok(anchors.every((tag) => /\bhref="[^"]+"/.test(tag)));
    assert.equal(dropdownButtons.length, 2);
    for (const [tag] of dropdownButtons) {
        assert.match(tag, /type="button"/);
        assert.match(tag, /aria-controls="[^"]+"/);
        assert.match(tag, /aria-expanded="false"/);
    }
    assert.match(html, /aria-label="Abrir menú de cuenta"/);
    assert.match(html, /aria-label="Abrir menú principal"/);
    assert.match(html, /id="cart-count"[^>]*role="status"/);
});

test('los controles de acción y enlaces rápidos no usan destinos vacíos', () => {
    const root = path.join(__dirname, '..');
    const templates = ['views/include/_nequi.ejs', 'views/include/_footer.ejs', 'views/include/_footerAdmin.ejs'];

    for (const relativePath of templates) {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.doesNotMatch(source, /href=["'](?:#|)["']/);
    }

    const nequi = fs.readFileSync(path.join(root, 'views/include/_nequi.ejs'), 'utf8');
    assert.match(nequi, /<button[\s\S]*aria-label="Mostrar opciones de pago por Nequi"/);
    assert.match(nequi, /aria-labelledby="nequiModalTitle"/);
});
