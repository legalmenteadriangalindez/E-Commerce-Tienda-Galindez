const raffle = require('../business/raffleService');
const banner = require('../middleware/raffleBanner');

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
        const data = await raffle.adminData();
        const raffleNotice = req.session.raffleNotice || '';
        delete req.session.raffleNotice;
        const renderPage = () => res.render('admin/raffle/manage', { ...data, raffleNotice });

        // El token CSRF se crea antes de llegar a esta ruta. Guardar la sesión
        // explícitamente evita que Render entregue el formulario antes de que
        // connect-mongo haya persistido el token que luego validará Multer.
        if (typeof req.session.save !== 'function') return renderPage();

        return req.session.save(error => {
            if (error) return next(error);
            return renderPage();
        });
    } catch (error) {
        return next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        await raffle.updateConfig(req.body, req.file);
        banner.clearCache();
        req.session.raffleNotice = 'Configuración de la rifa guardada.';
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
