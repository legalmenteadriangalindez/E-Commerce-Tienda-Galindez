const { renderInvoice } = require('./invoice');
const { renderOrderNotification } = require('./order');
const { renderRaffleWinner } = require('./raffleWinner');
const { STATUS_LABELS } = require('./status');

function renderNotification(event = {}) {
    const data = event.datos || {};

    if (event.tipo === 'FACTURA_PEDIDO') return renderInvoice(data);
    if (event.tipo === 'RIFA_GANADOR') return renderRaffleWinner(data);
    return renderOrderNotification(event);
}

module.exports = {
    STATUS_LABELS,
    renderOrderNotification: renderNotification,
};
