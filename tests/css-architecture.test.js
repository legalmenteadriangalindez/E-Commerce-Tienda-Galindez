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
        .filter((filename) => path.relative(cssRoot, filename) !== path.join('core', 'theme.css'))
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
            return /\/css\/core\/theme\.css/.test(source) && !/\/css\/components\/ui\.css/.test(source);
        })
        .map((filename) => path.relative(root, filename));

    assert.deepEqual(offenders, []);
});

test('los componentes visuales tienen una hoja canónica y el área administrativa su capa común', () => {
    const uiSource = fs.readFileSync(path.join(cssRoot, 'components', 'ui.css'), 'utf8');
    for (const selector of ['.ui-button', '.ui-table', '.ui-form', '.ui-card', '.ui-modal']) {
        assert.match(uiSource, new RegExp(`${selector.replace('.', '\\.')}(?:\\W|$)`));
    }

    const adminHeader = fs.readFileSync(path.join(viewsRoot, 'include', '_headerAdmin.ejs'), 'utf8');
    assert.match(adminHeader, /\/css\/components\/admin\.css/);
    assert.ok(fs.existsSync(path.join(cssRoot, 'components', 'admin.css')));
});

test('la estructura core contiene reset, layout y tema canónicos', () => {
    for (const filename of ['reset.css', 'layout.css', 'theme.css', 'header.css', 'footer.css']) {
        assert.equal(fs.existsSync(path.join(cssRoot, 'core', filename)), true, `core/${filename}`);
    }
});

test('las capas globales no publican selectores heredados sin ámbito', () => {
    const layoutSource = fs.readFileSync(path.join(cssRoot, 'core', 'layout.css'), 'utf8');
    const headerSource = fs.readFileSync(path.join(cssRoot, 'core', 'header.css'), 'utf8');
    const footerSource = fs.readFileSync(path.join(cssRoot, 'core', 'footer.css'), 'utf8');

    assert.doesNotMatch(layoutSource, /(?:^|[,{\s])\.container\s*\{/);
    assert.doesNotMatch(layoutSource, /\.(?:pay-link|descripcion-corta|text-sumary)\b/);
    assert.match(layoutSource, /\.payment-link\b/);
    assert.match(layoutSource, /\.product-description-truncated\b/);
    assert.match(layoutSource, /\.summary-text\b/);

    assert.doesNotMatch(headerSource, /(?:^|[,{\s])\.(?:navbar|nav-link|nav-right|search-form|profile-btn)\s*\{/);
    assert.match(headerSource, /\.app-navbar\b/);
    assert.match(headerSource, /\.app-nav-link\b/);
    assert.match(headerSource, /\.app-search-form\b/);

    assert.doesNotMatch(
        footerSource,
        /(?:^|[,{\s])\.(?:footer|footer-container|footer-col|socials|footer-bottom)\s*\{/
    );
    assert.match(footerSource, /\.app-footer\b/);
    assert.match(footerSource, /\.app-footer-container\b/);
});

test('las vistas usan contenedores con intención de página', () => {
    const login = fs.readFileSync(path.join(viewsRoot, 'client', 'auth', 'login.ejs'), 'utf8');
    const register = fs.readFileSync(path.join(viewsRoot, 'client', 'auth', 'register.ejs'), 'utf8');
    const brandForm = fs.readFileSync(path.join(viewsRoot, 'admin', 'brands', 'create_marca.ejs'), 'utf8');
    const profile = fs.readFileSync(path.join(viewsRoot, 'admin', 'profile', 'profile.ejs'), 'utf8');

    for (const source of [login, register]) {
        assert.match(source, /class="auth-shell"/);
        assert.doesNotMatch(source, /class="container"/);
    }
    assert.match(brandForm, /class="admin-brand-form"/);
    assert.doesNotMatch(brandForm, /class="container mt-4"/);
    assert.match(profile, /class="profile-container"/);
});
