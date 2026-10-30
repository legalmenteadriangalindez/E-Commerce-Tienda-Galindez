const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? files(filename) : [filename];
    });

test('las páginas consultan servicios directamente y no contienen clientes HTTP', () => {
    for (const filename of files(path.join(root, 'server/pages'))) {
        const source = fs.readFileSync(filename, 'utf8');
        assert.doesNotMatch(
            source,
            /require\(['"](?:axios|https?|node:https?|\.\.\/controller\/[^'"]+)['"]\)|\bfetch\s*\(/,
            filename
        );
    }
    assert.equal(
        files(path.join(root, 'server/services')).some((filename) => /\/render[^/]+\.js$/i.test(filename)),
        false
    );
    for (const filename of files(path.join(root, 'server/business'))) {
        assert.doesNotMatch(
            fs.readFileSync(filename, 'utf8'),
            /require\(['"]\.\.\/(?:pages|controller|routes)\//,
            filename
        );
    }
});

test('las páginas y controladores no acceden directamente a modelos', () => {
    const boundaryFiles = [
        ...files(path.join(root, 'server/pages')),
        ...files(path.join(root, 'server/controller')),
    ].filter((filename) => filename.endsWith('.js'));

    for (const filename of boundaryFiles) {
        const source = fs.readFileSync(filename, 'utf8');
        assert.doesNotMatch(source, /require\(['"][^'"]*\/model\/[^'"]+['"]\)/, path.relative(root, filename));
    }
});

test('los módulos del servidor no tienen dependencias circulares', () => {
    const graph = new Map();
    for (const file of files(path.join(root, 'server')).filter((file) => file.endsWith('.js'))) {
        const dependencies = [];
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
            dependencies.push(require.resolve(path.resolve(path.dirname(file), match[1])));
        }
        graph.set(file, dependencies);
    }
    const complete = new Set();
    function visit(file, stack = []) {
        assert.ok(
            !stack.includes(file),
            `Dependencia circular: ${[...stack, file].map((f) => path.relative(root, f)).join(' -> ')}`
        );
        if (complete.has(file) || !graph.has(file)) return;
        for (const dependency of graph.get(file)) visit(dependency, [...stack, file]);
        complete.add(file);
    }
    for (const file of graph.keys()) visit(file);
});

test('las plantillas no contienen estilos ni scripts ejecutables inline', () => {
    for (const filename of files(path.join(root, 'views')).filter((file) => file.endsWith('.ejs'))) {
        const source = fs
            .readFileSync(filename, 'utf8')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<%[\s\S]*?%>/g, 'sample');
        assert.doesNotMatch(source, /<style\b|\sstyle\s*=/i, filename);
        for (const match of source.matchAll(/<script\b((?:[^>]|%>)*?)>[\s\S]*?<\/script>/gi)) {
            assert.match(match[1], /\bsrc=|type=["']application\/ld\+json["']/i, filename);
        }
        if (/<head>/.test(source)) assert.match(source, /\/css\/theme\.css/, filename);
    }
});
