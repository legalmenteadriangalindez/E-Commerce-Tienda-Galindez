try {
    const fs = require('node:fs');
    const path = require('node:path');
    const { Script } = require('node:vm');
    const { wrap } = require('node:module');
    const root = path.resolve(__dirname, '..');
    const files = [];
    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(absolute);
            else if (/\.(js|ejs)$/.test(entry.name)) files.push(absolute);
        }
    }
    for (const directory of ['server', 'scripts', 'assets/js', 'public/js', 'views', 'tests']) walk(path.join(root, directory));
    files.push(path.join(root, 'server.js'));
    for (const file of files) {
        if (file.endsWith('.ejs')) require('ejs').compile(fs.readFileSync(file, 'utf8'), { filename: file });
        else {
            new Script(wrap(fs.readFileSync(file, 'utf8').replace(/^#!.*(?:\n|$)/, '')), { filename: file });
        }
    }
    require("../server/routes");
    console.log(`Sintaxis y plantillas comprobadas (${files.length} archivos). Las rutas se cargaron correctamente.`);
} catch (error) {
    console.error("No se pudieron cargar las rutas:", error);
    process.exit(1);
}
