exports.renderVerificationCode = (req, res) =>
    res.render('include/_verificationCode', { email: typeof req.query.email === 'string' ? req.query.email : '' });
