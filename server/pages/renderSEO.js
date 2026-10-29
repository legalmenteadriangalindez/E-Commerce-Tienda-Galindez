const dotenv = require('dotenv');
const catalog = require('../business/catalogService');

dotenv.config();

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ======================================================
// SITEMAP.XML
// ======================================================

exports.sitemap = async (req, res) => {
    try {
        // Reutilizar el servicio de catálogo evita una llamada HTTP al propio
        // dominio mientras se genera el sitemap.
        const productos = await catalog.listAllPublic();

        // ----------------------------------------------
        // XML BASE
        // ----------------------------------------------

        let urls = [];

        // ----------------------------------------------
        // PÁGINAS PÚBLICAS PRINCIPALES
        // ----------------------------------------------

        urls.push({
            loc: `${BASE_URL}/`,
            priority: '1.0',
        });

        urls.push({
            loc: `${BASE_URL}/clothes`,
            priority: '0.8',
        });

        urls.push({
            loc: `${BASE_URL}/promociones`,
            priority: '0.8',
        });

        urls.push({
            loc: `${BASE_URL}/marcas`,
            priority: '0.7',
        });

        // Información pública que debe poder encontrar el cliente y los
        // buscadores sin depender de una sesión iniciada.
        [
            ['/sorteo', '0.6'],
            ['/privacidad', '0.5'],
            ['/terminos', '0.5'],
            ['/cambios-devoluciones', '0.5'],
            ['/envios', '0.5'],
            ['/reclamaciones', '0.5'],
        ].forEach(([path, priority]) => {
            urls.push({ loc: `${BASE_URL}${path}`, priority });
        });

        // ----------------------------------------------
        // CATEGORÍAS
        // ----------------------------------------------

        const categorias = [...new Set(productos.map((producto) => producto.categoria?.nombre).filter(Boolean))];

        categorias.forEach((nombreCategoria) => {
            urls.push({
                loc: `${BASE_URL}/categoria/${encodeURIComponent(nombreCategoria)}`,
                priority: '0.8',
            });
        });

        // ----------------------------------------------
        // PRODUCTOS
        // ----------------------------------------------

        productos.forEach((producto) => {
            const id = producto._id || producto.id;

            if (!id) return;

            urls.push({
                loc: `${BASE_URL}/Detalles/${id}`,
                priority: '0.9',
            });
        });

        // ----------------------------------------------
        // GENERAR XML
        // ----------------------------------------------

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;

        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        urls.forEach((url) => {
            xml += `    <url>\n`;

            xml += `        <loc>${escapeXml(url.loc)}</loc>\n`;

            xml += `        <changefreq>weekly</changefreq>\n`;

            xml += `        <priority>${url.priority}</priority>\n`;

            xml += `    </url>\n`;
        });

        xml += `</urlset>`;

        // ----------------------------------------------
        // RESPUESTA
        // ----------------------------------------------

        res.status(200);

        // res.set('Content-Type', 'application/xml');
        // res.set('application/xml');
        res.type('application/xml');

        res.send(xml);
    } catch (error) {
        console.error('ERROR GENERANDO SITEMAP:', error.response?.data || error.message);

        res.status(500).send('Error generando sitemap.xml');
    }
};

// ======================================================
// ROBOTS.TXT
// ======================================================

exports.robots = (req, res) => {
    res.type('text/plain');

    res.send(`
User-agent: *
Allow: /

Disallow: /perfil
Disallow: /view_cart
Disallow: /payment-point
Disallow: /venta-finalizada
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml
`);
};

// ======================================================
// ESCAPAR CARACTERES XML
// ======================================================

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
