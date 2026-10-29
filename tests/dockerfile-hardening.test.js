const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('la imagen de producción ejecuta el proceso sin privilegios', () => {
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');

    assert.match(dockerfile, /^USER node$/m);
    assert.match(dockerfile, /COPY --chown=node:node package\.json package-lock\.json/);
    assert.match(dockerfile, /COPY --chown=node:node \. \./);
    assert.doesNotMatch(dockerfile, /^USER root$/m);
});

test('la imagen define un healthcheck y apagado ordenado', () => {
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');

    assert.match(dockerfile, /^HEALTHCHECK .*\/healthz/m);
    assert.match(dockerfile, /^STOPSIGNAL SIGTERM$/m);
});
