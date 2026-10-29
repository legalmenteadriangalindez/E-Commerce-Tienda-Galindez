const test = require('node:test');
const assert = require('node:assert/strict');

const legal = require('../server/pages/renderLegal');

test('las páginas legales públicas están registradas y tienen controlador', () => {
    assert.deepEqual(
        legal.legalPages.map((page) => page.path),
        ['/privacidad', '/terminos', '/cambios-devoluciones', '/envios', '/reclamaciones']
    );

    for (const page of legal.legalPages) {
        assert.equal(typeof legal.page(page.key), 'function');
        assert.ok(legal.policies[page.key].sections.length > 0);
    }
});

test('la información de contacto legal tiene valores seguros por defecto', () => {
    assert.equal(legal.contact.businessName, 'Tienda Galindez');
    assert.match(legal.contact.email, /^[^@\s]+@[^@\s]+$/);
    assert.match(legal.contact.phone.replace(/\D/g, ''), /^\d{7,}$/);
    assert.ok(legal.contact.city);
});

test('el controlador hidrata los datos de contacto también en el SEO', () => {
    let rendered;
    legal.page('terminos')(
        {},
        {
            render(_view, data) {
                rendered = data;
            },
        }
    );

    assert.ok(rendered);
    assert.doesNotMatch(rendered.seoDescription, /\{\{/);
    assert.doesNotMatch(rendered.policy.sections[3].paragraphs[0], /\{\{/);
});
