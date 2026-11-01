exports.saveSession = (req) =>
    new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
