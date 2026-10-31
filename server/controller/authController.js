const sendEmail = require('../config/sendEmail');
const accounts = require('../business/accountService');
const { permissionsForRole } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const { DEFAULT_SESSION_MAX_AGE_MS, REMEMBERED_SESSION_MAX_AGE_MS } = require('../config/sessionPolicy');

// LOGIN

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const rememberMe = req.body?.rememberMe === 'true' || req.body?.rememberMe === true;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            Buffer.byteLength(password, 'utf8') > 72 ||
            !accounts.normalizeEmail(email)
        ) {
            return res.status(400).send('Correo y contraseña requeridos');
        }

        const usuario = await accounts.authenticate(email, password);

        // Respuesta genérica para evitar revelar
        // información sobre cuentas existentes
        if (!usuario || usuario.estado !== 'Activo' || !usuario.rol?.nombre) {
            return res.status(401).send('Credenciales inválidas');
        }

        // Una autenticación correcta reinicia los fallos acumulados para esta cuenta.
        try {
            await req.clearLoginAccountLimit?.();
        } catch (error) {
            console.error('No se pudo reiniciar el contador de login:', error.message);
        }

        // Solo permitir el acceso después de verificar el correo.
        if (usuario.verified !== true) {
            return res.redirect(`/verify-email?email=${encodeURIComponent(usuario.email)}`);
        }

        // Conservar el carrito de la sesión anterior
        const carritoAnterior = Array.isArray(req.session.cart) ? req.session.cart : [];

        // Crear un nuevo ID de sesión al iniciar sesión
        return req.session.regenerate((error) => {
            if (error) {
                return res.status(500).send('No se pudo iniciar sesión');
            }

            const permisos = permissionsForRole(usuario.rol);

            // Guardar únicamente datos necesarios
            req.session.user = {
                _id: usuario._id.toString(),
                authVersion: usuario.authVersion || 0,
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                direccion: usuario.direccion,
                ciudad: usuario.ciudad,
                ubicacion: usuario.ubicacion,
                rol: {
                    nombre: usuario.rol.nombre,
                    permisos,
                },
            };

            req.session.cart = carritoAnterior;
            const rememberClient = rememberMe && usuario.rol.nombre === 'Cliente';
            req.session.cookie.maxAge = rememberClient
                ? REMEMBERED_SESSION_MAX_AGE_MS
                : DEFAULT_SESSION_MAX_AGE_MS;

            req.session.save((error) => {
                if (error) {
                    return res.status(500).send('No se pudo guardar la sesión');
                }

                if (usuario.rol.nombre === 'dealer') {
                    return res.redirect('/dealer/orders/read');
                }

                if (permisos.includes(P.ADMIN_ACCESS)) {
                    if (permisos.includes(P.PAYMENTS_MANAGE)) return res.redirect('/billing-point');
                    if (permisos.includes(P.ANALYTICS_READ)) return res.redirect('/admin-analytics');
                    if (permisos.includes(P.CATALOG_READ)) return res.redirect('/read-producto');
                    if (permisos.includes(P.ORDERS_READ)) return res.redirect('/read-order');
                    if (permisos.includes(P.PAYMENTS_READ)) return res.redirect('/admin/payments');
                    if (permisos.includes(P.SALES_READ)) return res.redirect('/read-sales');
                    if (permisos.includes(P.DELIVERY_MANAGE)) return res.redirect('/admin/delivery');
                    if (permisos.includes(P.STORE_SETTINGS_MANAGE)) return res.redirect('/admin/settings/shipping');
                    if (permisos.includes(P.ROLES_MANAGE)) return res.redirect('/read-rol');
                    if (permisos.includes(P.USERS_MANAGE)) return res.redirect('/read-user');
                }

                return res.redirect('/');
            });
        });
    } catch (error) {
        console.error('Error en login:', error.message);

        return res.status(500).send('No se pudo iniciar sesión');
    }
};

// LOGOUT

exports.logout = (req, res) => {
    if (!req.session) {
        return res.redirect('/login');
    }

    req.session.destroy((error) => {
        if (error) {
            return res.status(500).send('No se pudo cerrar sesión');
        }

        res.clearCookie('tienda.sid');

        return res.redirect('/login');
    });
};

// ======================= REGISTER =======================
exports.register = async (req, res, next) => {
    try {
        const data = {};
        for (const field of ['nombre', 'telefono', 'direccion', 'genero', 'barrio', 'ciudad', 'puntoReferencia']) {
            if (typeof req.body[field] !== 'string' || !req.body[field].trim() || req.body[field].length > 200) {
                return res.status(400).send('Completa los datos del formulario con texto válido.');
            }
            data[field] = req.body[field].trim();
        }
        const email = accounts.normalizeEmail(req.body.email);
        if (!email || !accounts.validPassword(req.body.password)) {
            return res
                .status(400)
                .send('Revisa el correo y usa una contraseña de al menos 12 caracteres y máximo 72 bytes.');
        }
        const target = '/verify-email?email=' + encodeURIComponent(email);
        // El registro repetido no reenvía códigos ni cambia la contraseña.
        const registration = await accounts.register({ data, email, password: req.body.password });
        if (registration.existing) return res.redirect(303, target);
        if (!registration.available) return res.status(503).send('El registro todavía no está disponible.');
        await sendEmail(registration.email, registration.code);
        res.redirect(303, target);
    } catch (error) {
        if (error.code === 11000) return res.redirect(303, '/login');
        next(error);
    }
};
