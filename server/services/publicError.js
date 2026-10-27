function publicError(error) {
    if (error?.expose && typeof error.message === 'string') return error.message.slice(0, 500);
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    if ([400, 401, 403, 404, 409, 422, 429].includes(status) && typeof message === 'string') return message.slice(0, 500);
    return 'No se pudo completar la solicitud. Inténtalo de nuevo.';
}
function errorStatus(error) {
    const status = error?.response?.status || (error?.expose && error.status);
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}
module.exports = { publicError, errorStatus };
