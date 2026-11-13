'use strict';

const storeSettings = require('../../business/storeSettingsService');
const money = require('../../services/money');

function saveSession(req) {
    return new Promise((resolve, reject) => {
        if (typeof req.session.save !== 'function') return resolve();
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

exports.index = async (req, res, next) => {
    try {
        const shipping = await storeSettings.getShippingPolicy({ force: true });
        const notice = req.session.shippingSettingsNotice || '';
        delete req.session.shippingSettingsNotice;
        return res.render('admin/settings/shipping', { shipping, notice, user: req.usuarioActual });
    } catch (error) {
        return next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const shipping = await storeSettings.updateShippingPolicy(req.body, req.session.user?._id);
        req.session.shippingSettingsNotice =
            `Configuración guardada. Envío estándar: ${money.formatCOP(shipping.shippingPriceCents)}; ` +
            `envío gratis desde ${money.formatCOP(shipping.freeShippingFromCents)}.`;
        await saveSession(req);
        return res.redirect(303, '/admin/settings/shipping');
    } catch (error) {
        return next(error);
    }
};
