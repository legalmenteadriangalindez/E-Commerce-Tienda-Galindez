module.exports = function internalApiConfig(req) {
    return {
        headers: {
            Cookie: req.headers?.cookie || '',
            'X-CSRF-Token': req.session?.csrfToken || ''
        },
        timeout: 10000
    };
};
