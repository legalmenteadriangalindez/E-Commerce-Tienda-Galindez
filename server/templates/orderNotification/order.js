const {
    addressParts,
    escapeHtml,
    formatHeaderText,
    formatMoney,
    formatText,
    publicUrl,
    renderEmailDocument,
} = require('./shared');
const { STATUS_LABELS } = require('./status');

function subjectForOrder(event) {
    const data = event.datos || {};
    const number = formatHeaderText(data.numeroOrden || 'tu pedido');

    if (event.tipo === 'PEDIDO_RECIBIDO') return `Recibimos ${number} - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENVIO') return `${number} va en camino - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENTREGA') return `${number} fue entregado - Tienda Galindez`;
    return `Actualización de ${number} - Tienda Galindez`;
}

function messageForOrder(event) {
    const data = event.datos || {};

    if (event.tipo === 'PEDIDO_RECIBIDO') {
        if (data.metodoPago === 'CASH_ON_DELIVERY') {
            return 'Recibimos tu pedido. Paga el total al repartidor cuando lo recibas.';
        }

        return data.estadoPago === 'PAGADO'
            ? 'Recibimos tu pedido y el pago fue registrado correctamente.'
            : 'Recibimos tu pedido. El pago todavía está pendiente de confirmación.';
    }

    if (event.tipo === 'AVISO_ENVIO') return 'Tu pedido fue preparado y ya está en camino.';
    if (event.tipo === 'AVISO_ENTREGA') {
        return 'El pedido aparece como entregado. Gracias por comprar en Tienda Galindez.';
    }
    if (data.estado === 'CANCELADA') {
        return 'Tu pedido fue cancelado. Si necesitas ayuda, contáctanos.';
    }

    return `El estado actual de tu pedido es: ${STATUS_LABELS[data.estado] || data.estado}.`;
}

function renderOrderNotification(event) {
    const data = event.datos || {};
    const greeting = escapeHtml(data.nombre || 'Cliente');
    const number = escapeHtml(data.numeroOrden || 'Pedido');
    const status = escapeHtml(data.estadoLabel || STATUS_LABELS[data.estado] || data.estado || 'Pendiente');
    const message = messageForOrder(event);
    const products = Array.isArray(data.productos) ? data.productos : [];
    const items = products.length
        ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">
            ${products
                .map(
                    (item) => `<tr>
                        <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.nombre)} × ${escapeHtml(item.cantidad)}</td>
                        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatMoney(item.subtotal))}</td>
                    </tr>`
                )
                .join('')}
        </table>`
        : '';
    const address = addressParts(data.direccion).map(escapeHtml).join(', ');
    const addressBlock = address ? `<p><strong>Entrega:</strong> ${address}</p>` : '';
    const htmlContent = renderEmailDocument(`
        <h2 style="color:#d85c32">Tienda Galindez</h2>
        <p>Hola, ${greeting}.</p>
        <p>${escapeHtml(message)}</p>
        <p><strong>Pedido:</strong> ${number}<br><strong>Estado:</strong> ${status}</p>
        ${items}
        ${addressBlock}
        <p style="font-size:18px"><strong>Total: ${escapeHtml(formatMoney(data.total))}</strong></p>
        <p>Consulta el estado desde <a href="${publicUrl('/mis-pedidos')}">Mis pedidos</a>.</p>
    `);
    const textContent = `Hola, ${formatText(data.nombre || 'Cliente')}.\n\n${message}\nPedido: ${formatText(data.numeroOrden || 'Pedido')}\nEstado: ${formatText(data.estadoLabel || data.estado || 'Pendiente')}\nTotal: ${formatMoney(data.total)}\n\nConsulta el estado en Mis pedidos.`;

    return {
        subject: subjectForOrder(event),
        htmlContent,
        textContent,
    };
}

module.exports = { messageForOrder, renderOrderNotification, subjectForOrder };
