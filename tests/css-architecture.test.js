const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const cssRoot = path.join(root, 'public', 'css');
const viewsRoot = path.join(root, 'views');

function files(directory, extension) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) return files(filename, extension);
        return entry.isFile() && filename.endsWith(extension) ? [filename] : [];
    });
}

test('la paleta global es la única que declara :root', () => {
    const duplicateRoots = files(cssRoot, '.css')
        .filter((filename) => path.basename(filename) !== 'theme.css')
        .filter((filename) => /:root\s*\{/.test(fs.readFileSync(filename, 'utf8')))
        .map((filename) => path.relative(root, filename));

    assert.deepEqual(duplicateRoots, []);
});

test('las hojas no reintroducen alias de colores heredados', () => {
    const legacyAliases =
        /var\(--(?:primary-dark|accent-orange|warm-tan|light-bg|light|white|background|border|text-muted|text-soft|success|danger|primary|soft-bg|coffee-dark|burnt-orange|tan-clay|bg-soft|text-dark|border-soft|border-light|orange-soft|input-bg|ar-(?:ink|muted|line|accent))\b/;
    const offenders = files(cssRoot, '.css')
        .filter((filename) => legacyAliases.test(fs.readFileSync(filename, 'utf8')))
        .map((filename) => path.relative(root, filename));

    assert.deepEqual(offenders, []);
});

test('las vistas que cargan el tema también exponen los componentes reutilizables', () => {
    const offenders = files(viewsRoot, '.ejs')
        .filter((filename) => {
            const source = fs.readFileSync(filename, 'utf8');
            return /\/css\/theme\.css/.test(source) && !/\/css\/components\/ui\.css/.test(source);
        })
        .map((filename) => path.relative(root, filename));

    assert.deepEqual(offenders, []);
});
