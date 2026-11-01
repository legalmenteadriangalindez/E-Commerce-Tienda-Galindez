exports.login = (req, res) => res.render('client/auth/login', { passwordChanged: req.query.passwordChanged === '1' });
