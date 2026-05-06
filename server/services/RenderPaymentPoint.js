exports.payment_point = (req, res) => {

    const cart = req.session.cart || {
        items: [],
        total: 0
    };

    res.render('client/payment/payment_point', {
        user: req.session.user,
        cart
    });
};

exports.billing_point = (req, res) => {
    res.render('admin/home/Billing_point', {
        user: req.session.user
    });
}


