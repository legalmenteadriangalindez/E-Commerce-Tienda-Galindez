const crypto = require('node:crypto');
const helmet = require('helmet');
module.exports = (app) => {
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        req.requestId = crypto.randomUUID();
        res.locals.cspNonce = crypto.randomBytes(18).toString('base64');
        res.set('X-Request-Id', req.requestId);
        res.set('Cache-Control', 'no-store');
        next();
    });
    app.use(
        helmet({
            referrerPolicy: { policy: 'no-referrer' },
            strictTransportSecurity: process.env.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
                    scriptSrcAttr: ["'none'"],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        'https://cdn.jsdelivr.net',
                        'https://cdnjs.cloudflare.com',
                        'https://fonts.googleapis.com',
                    ],
                    fontSrc: [
                        "'self'",
                        'data:',
                        'https://cdn.jsdelivr.net',
                        'https://cdnjs.cloudflare.com',
                        'https://fonts.gstatic.com',
                    ],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'"],
                    formAction: ["'self'", 'https://checkout.wompi.co'],
                    objectSrc: ["'none'"],
                    frameAncestors: ["'none'"],
                    baseUri: ["'none'"],
                    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
                },
            },
        })
    );
};
