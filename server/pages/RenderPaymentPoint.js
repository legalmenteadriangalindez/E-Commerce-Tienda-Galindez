exports.billing_point = (req, res) => {
    res.render('admin/home/Billing_point', {
        user: req.session.user,
    });
};
