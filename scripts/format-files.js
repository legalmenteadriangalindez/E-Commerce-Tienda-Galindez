'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
let ejsFailures = 0;

// Prettier no interpreta EJS sin un plugin. Normalizamos solo espacios finales
// y saltos de línea, sin reescribir sus etiquetas ni expresiones.
function tidyViews(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) tidyViews(file);
        else if (file.endsWith('.ejs')) {
            const source = fs.readFileSync(file, 'utf8');
            const normalized =
                source
                    .replace(/\r\n?/g, '\n')
                    .replace(/[\t ]+$/gm, '')
                    .trimEnd() + '\n';
            if (source === normalized) continue;
            if (check) {
                console.error('Revisar espacios/saltos de línea: ' + path.relative(root, file));
                ejsFailures++;
            } else fs.writeFileSync(file, normalized);
        }
    }
}
tidyViews(path.join(root, 'views'));

// Globs incluyen archivos nuevos. EJS se compila con npm run check.
// Las migraciones publicadas conservan su checksum; nunca se reformatean.
const files = [
    '*.js',
    '*.json',
    '*.md',
    '*.yaml',
    '.github/workflows/*.{yml,yaml}',
    'api/**/*.js',
    'server/**/*.js',
    'scripts/**/*.js',
    'tests/**/*.js',
    'assets/**/*.{js,css}',
    'public/**/*.{js,css}',
];
const result = spawnSync(
    process.execPath,
    [require.resolve('prettier/bin/prettier.cjs'), check ? '--check' : '--write', ...files],
    { cwd: root, stdio: 'inherit' }
);
process.exit(result.status || (ejsFailures ? 1 : (result.status ?? 1)));
