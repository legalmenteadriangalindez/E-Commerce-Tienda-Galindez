// Doble del límite de persistencia: mantiene reales servicios, rutas y middleware.
module.exports = function queryStub(value, calls = {}) {
    const query = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
    for (const name of ['select', 'populate', 'sort', 'skip', 'limit', 'lean', 'session']) {
        query[name] = (...args) => {
            (calls[name] ||= []).push(args);
            return query;
        };
    }
    return query;
};
