const raffle = require('../business/raffleService');
const banner = require('../middleware/raffleBanner');
const catalogPagination = require('./catalogPagination');

function logRaffle(event, req, extra = {}) {
    console.info(JSON.stringify({
        event,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        fields: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
        filePresent: Boolean(req.file),
        fileMimeType: req.file?.mimetype || undefined,
        fileSize: Number.isFinite(req.file?.size) ? req.file.size : undefined,
        ...extra
    }));
}

function logRaffle(event, req, extra = {}) {
    console.info(JSON.stringify({
        event,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        fields: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
        filePresent: Boolean(req.file),
        fileMimeType: req.file?.mimetype || undefined,
        fileSize: Number.isFinite(req.file?.size) ? req.file.size : undefined,
        ...extra
    }));
}

exports.publicIndex = async (req, res, next) => {
    try {
        return res.render('client/raffle/index', {
            raffle: await raffle.publicConfig(),
            user: req.usuarioActual || req.session.user
        });
    } catch (error) {
        return next(error);
    }
};

exports.adminIndex = async (req, res, next) => {
    try {
        const data = await raffle.adminData(req.query);
        data.pagination = catalogPagination.buildPagination(req, data.pagination);
        const raffleNotice = req.session.raffleNotice || '';
        delete req.session.raffleNotice;
        const renderPage = () => res.render('admin/raffle/manage', { ...data, raffleNotice });

        // El token CSRF se crea antes de llegar a esta ruta. Guardar la sesión
        // explícitamente evita que Render entregue el formulario antes de que
        // connect-mongo haya persistido el token que luego validará Multer.
        if (typeof req.session.save !== 'function') return renderPage();

        return req.session.save(error => {
            if (error) {
                console.error(JSON.stringify({
                    event: 'raffle_form_session_save_error',
                    requestId: req.requestId,
                    type: error.name,
                    code: error.code
                }));
                return next(error);
            }
            console.info(JSON.stringify({
                event: 'raffle_form_session_saved',
                requestId: req.requestId,
                path: req.path,
                csrfTokenPresent: Boolean(req.session.csrfToken)
            }));
            return renderPage();
        });
    } catch (error) {
        return next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        logRaffle('raffle_update_received', req);
        await raffle.updateConfig(req.body, req.file);
        banner.clearCache();
        req.session.raffleNotice = 'Configuración de la rifa guardada.';
        logRaffle('raffle_update_succeeded', req);
        return res.redirect(303, '/admin/raffle');
    } catch (error) {
        return next(error);
    }
};

exports.draw = async (req, res, next) => {
    try {
        if (req.body.confirmar !== 'si') throw new Error('Confirma el sorteo antes de continuar.');
        await raffle.drawWinner();
        banner.clearCache();
        req.session.raffleNotice = 'Ganador seleccionado. La rifa se desactivó para evitar nuevas participaciones.';
        return res.redirect(303, '/admin/raffle');
    } catch (error) {
        return next(error);
    }
};

exports.reset = async (req, res, next) => {
    try {
        if (req.body.confirmar !== 'si') throw new Error('Confirma el reinicio antes de continuar.');
        await raffle.resetRaffle();
        banner.clearCache();
        req.session.raffleNotice = 'Participaciones reiniciadas. Configura y activa una nueva rifa.';
        return res.redirect(303, '/admin/raffle');
    } catch (error) {
        return next(error);
    }
};
