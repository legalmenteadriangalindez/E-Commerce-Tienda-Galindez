const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createCategoryCache } = require('../server/business/categoryCache');

test('el caché de categorías deduplica consultas y permite invalidación', async () => {
    let calls = 0;
    const cache = createCategoryCache(async () => {
        calls += 1;
        return [{ _id: 'cat-1', nombre: 'Despensa' }];
    }, 60_000);

    const [first, second] = await Promise.all([cache.get(), cache.get()]);
    assert.equal(calls, 1);
    assert.strictEqual(first, second);
    assert.deepEqual(first, [{ _id: 'cat-1', nombre: 'Despensa' }]);

    await cache.get();
    assert.equal(calls, 1);

    cache.invalidate();
    await cache.get();
    assert.equal(calls, 2);
});

test('el middleware de categorías solo se monta en páginas que lo necesitan', () => {
    const root = path.join(__dirname, '..');
    const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const homeRoutes = fs.readFileSync(path.join(root, 'server/routes/home.routes.js'), 'utf8');
    const authRoutes = fs.readFileSync(path.join(root, 'server/routes/auth.routes.js'), 'utf8');

    assert.doesNotMatch(serverSource, /app\.use\(categoriasMiddleware\)/);
    assert.doesNotMatch(homeRoutes, /router\.use\(categoriasMiddleware\)/);
    assert.match(homeRoutes, /router\.get\(['"]\/['"],\s*categoriasMiddleware/);
    assert.match(homeRoutes, /router\.get\(['"]\/categoria\/\:nombre['"],\s*categoriasMiddleware/);
    assert.match(authRoutes, /router\.get\(['"]\/forgot-password['"],\s*categoriasMiddleware/);
});
