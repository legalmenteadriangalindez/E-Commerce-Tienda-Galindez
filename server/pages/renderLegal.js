const dotenv = require('dotenv');

dotenv.config();

const contact = {
    businessName: process.env.LEGAL_BUSINESS_NAME || 'Tienda Galindez',
    email: process.env.LEGAL_CONTACT_EMAIL || process.env.EMAIL_USER || 'tiendagalindez@gmail.com',
    phone: process.env.LEGAL_CONTACT_PHONE || '+57 301 208 4769',
    city: process.env.LEGAL_CITY || 'Timbío, Cauca, Colombia',
    lastUpdated: process.env.LEGAL_LAST_UPDATED || '27 de octubre de 2026',
};

const legalPages = [
    { key: 'privacidad', title: 'Privacidad', path: '/privacidad' },
    { key: 'terminos', title: 'Términos de compra', path: '/terminos' },
    { key: 'cambios-devoluciones', title: 'Cambios y devoluciones', path: '/cambios-devoluciones' },
    { key: 'envios', title: 'Envíos', path: '/envios' },
    { key: 'reclamaciones', title: 'Reclamaciones', path: '/reclamaciones' },
];

const policies = {
    privacidad: require('./legal/privacidad'),
    terminos: require('./legal/terminos'),
    'cambios-devoluciones': require('./legal/cambios-devoluciones'),
    envios: require('./legal/envios'),
    reclamaciones: require('./legal/reclamaciones'),
};

function fill(value) {
    return String(value).replace(/\{\{(businessName|email|phone|city)\}\}/g, (_, key) => {
        return contact[key];
    });
}

function hydratePolicy(policy) {
    return {
        ...policy,
        intro: fill(policy.intro),
        sections: policy.sections.map((section) => ({
            ...section,
            heading: fill(section.heading),
            paragraphs: (section.paragraphs || []).map(fill),
            items: (section.items || []).map(fill),
            note: section.note ? fill(section.note) : undefined,
        })),
    };
}

exports.page = (key) => (req, res, next) => {
    const policy = policies[key];
    if (!policy) return next();
    const hydratedPolicy = hydratePolicy(policy);

    return res.render('client/legal/page', {
        policy: hydratedPolicy,
        policyKey: key,
        legalPage: true,
        contact,
        legalPages,
        seoTitle: `${policy.title} | ${contact.businessName}`,
        seoDescription: hydratedPolicy.intro,
        seoCanonical: `${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/${key}`,
    });
};

exports.legalPages = legalPages;
exports.contact = contact;
exports.policies = policies;
