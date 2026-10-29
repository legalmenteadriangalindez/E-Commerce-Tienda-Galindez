const commerce = require('../business/commerceService');

exports.billing_point = (req, res) => {
    const shipping = commerce.shippingPolicy();
    res.render('admin/home/Billing_point', {
        user: req.session.user,
        shippingPriceCents: shipping.priceCents,
        freeShippingFromCents: shipping.freeAtCents,
    });
};
