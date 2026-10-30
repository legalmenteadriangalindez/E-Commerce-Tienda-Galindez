const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const viewsRoot = path.join(root, 'views');

function viewFiles(directory = viewsRoot, files = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) viewFiles(absolute, files);
        else if (entry.isFile() && entry.name.endsWith('.ejs')) files.push(absolute);
    }
    return files;
}

function assetCandidates(url) {
    if (url.startsWith('/assets/')) {
        const relative = url.slice('/assets/'.length);
        return [path.join(root, 'public', relative)];
    }
    if (url.startsWith('/css/')) {
        const relative = url.slice('/css/'.length);
        return [path.join(root, 'public', 'css', relative)];
    }
    if (url.startsWith('/js/')) {
        const relative = url.slice('/js/'.length);
        return [path.join(root, 'public', 'js', relative)];
    }
    if (url.startsWith('/img/')) {
        const relative = url.slice('/img/'.length);
        return [path.join(root, 'public', 'img', relative)];
    }
    return [];
}

test('todas las vistas apuntan a recursos estáticos existentes', () => {
    const missing = [];
    for (const filename of viewFiles()) {
        const source = fs.readFileSync(filename, 'utf8');
        for (const match of source.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
            const url = match[1];
            const candidates = assetCandidates(url);
            if (candidates.length && !candidates.some((candidate) => fs.existsSync(candidate))) {
                missing.push(`${path.relative(root, filename)} -> ${url}`);
            }
        }
    }
    assert.deepEqual(missing, [], `Recursos estáticos inexistentes:\n${missing.join('\n')}`);
});

test('las vistas usan la ruta canónica de recursos y los parciales no repiten estilos', () => {
    for (const filename of viewFiles()) {
        const source = fs.readFileSync(filename, 'utf8');
        assert.doesNotMatch(
            source,
            /(?:href|src)=["']\/assets\/(?:css|js|img)\//,
            `${path.relative(root, filename)} usa la ruta estática heredada /assets`
        );
    }

    assert.equal(fs.existsSync(path.join(root, 'assets')), false, 'assets/ no debe duplicar recursos versionados');

    for (const relative of [
        'views/include/card.ejs',
        'views/include/_cardClothes.ejs',
        'views/include/brand_card.ejs',
        'views/include/_carousel.ejs',
        'views/client/products/partials/product-reviews.ejs',
    ]) {
        const source = fs.readFileSync(path.join(root, relative), 'utf8');
        assert.doesNotMatch(source, /<link\b[^>]+stylesheet/i, `${relative} no debe cargar CSS por cada parcial`);
    }
});

test('conserva /assets como alias de compatibilidad sin duplicar archivos', () => {
    const appConfig = fs.readFileSync(path.join(root, 'server', 'config', 'appConfig.js'), 'utf8');
    assert.match(appConfig, /app\.use\('\/assets',\s*express\.static\(publicDirectory\)\)/);
    assert.equal(fs.existsSync(path.join(root, 'assets')), false);
});

test('todos los includes EJS apuntan a archivos existentes', () => {
    const missing = [];
    for (const filename of viewFiles()) {
        const source = fs.readFileSync(filename, 'utf8');
        for (const match of source.matchAll(/include\(['"]([^'"]+)['"]/g)) {
            const target = match[1];
            const candidate = path.resolve(path.dirname(filename), target.endsWith('.ejs') ? target : `${target}.ejs`);
            if (!fs.existsSync(candidate)) missing.push(`${path.relative(root, filename)} -> ${target}`);
        }
    }
    assert.deepEqual(missing, [], `Includes EJS inexistentes:\n${missing.join('\n')}`);
});
