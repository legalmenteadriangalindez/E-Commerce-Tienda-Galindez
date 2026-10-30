const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const saveSession = (req) =>
    new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));

module.exports = { saveSession, wrap };
