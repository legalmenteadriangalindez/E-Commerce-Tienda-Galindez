const commerce = require('../business/commerceService');

exports.billing_point = async (req, res, next) => {
    try {
        const shipping = await commerce.loadShippingPolicy();
        return res.render('admin/home/Billing_point', {
            user: req.session.user,
            shippingPriceCents: shipping.shippingPriceCents,
            freeShippingFromCents: shipping.freeShippingFromCents,
        });
    } catch (error) {
        return next(error);
    }
};
