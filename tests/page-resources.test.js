const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const { resources } = require('../server/config/pageResources');

test('el registro de recursos de vistas solo apunta a archivos públicos existentes', () => {
    const missing = [];

    for (const [view, config] of Object.entries(resources)) {
        for (const resource of [...(config.pageCss || []), ...(config.pageJs || [])]) {
            const match = resource.match(/^\/(css|js)\/(.+)$/);
            if (!match || !fs.existsSync(path.join(root, 'public', match[1], match[2]))) {
                missing.push(`${view} -> ${resource}`);
            }
        }
    }

    assert.deepEqual(missing, [], `Recursos de vista inexistentes:\n${missing.join('\n')}`);
});

test('los encabezados solo cargan recursos base y delegan los de cada página', () => {
    for (const relative of [
        'views/include/header/head.ejs',
        'views/include/_headerAdmin.ejs',
        'views/include/_headerDealer.ejs',
    ]) {
        const source = fs.readFileSync(path.join(root, relative), 'utf8');
        assert.match(source, /headerPageCss/);
        assert.match(source, /headerPageJs/);
        assert.doesNotMatch(
            source,
            /<link[^>]+href="\/css\/(?:analytics|raffle|admin-pagination|cards|payment_point)\.css"/
        );
    }
});
