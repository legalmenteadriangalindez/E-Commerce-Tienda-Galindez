const STATUS_LABELS = {
    PENDIENTE: 'Pendiente de pago',
    PAGADA: 'Pago confirmado',
    PREPARANDO: 'En preparación',
    ENVIADA: 'En camino',
    ENTREGADA: 'Entregada',
    CANCELADA: 'Cancelada',
    REQUIERE_REVISION: 'Requiere revisión',
};

function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]
    );
}

function money(value) {
    return Number(value || 0).toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    });
}

function subjectFor(event) {
    const order = event.datos || {};
    if (event.tipo === 'RIFA_GANADOR') return `¡Ganaste el sorteo! Número ${order.numero} - Tienda Galindez`;
    const number = order.numeroOrden || 'tu pedido';
    if (event.tipo === 'PEDIDO_RECIBIDO') return `Recibimos ${number} - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENVIO') return `${number} va en camino - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENTREGA') return `${number} fue entregado - Tienda Galindez`;
    return `Actualización de ${number} - Tienda Galindez`;
}

function messageFor(event) {
    const data = event.datos || {};
    if (event.tipo === 'RIFA_GANADOR') {
        return `¡Felicitaciones! Tu número de participación #${data.numero} ganó el sorteo "${data.titulo || 'Sorteo de regalos'}".`;
    }
    if (event.tipo === 'PEDIDO_RECIBIDO') {
        if (data.metodoPago === 'CASH_ON_DELIVERY')
            return 'Recibimos tu pedido. Paga el total al repartidor cuando lo recibas.';
        return data.estadoPago === 'PAGADO'
            ? 'Recibimos tu pedido y el pago fue registrado correctamente.'
            : 'Recibimos tu pedido. El pago todavía está pendiente de confirmación.';
    }
    if (event.tipo === 'AVISO_ENVIO') return 'Tu pedido fue preparado y ya está en camino.';
    if (event.tipo === 'AVISO_ENTREGA')
        return 'El pedido aparece como entregado. Gracias por comprar en Tienda Galindez.';
    if (data.estado === 'CANCELADA') return 'Tu pedido fue cancelado. Si necesitas ayuda, contáctanos.';
    return `El estado actual de tu pedido es: ${STATUS_LABELS[data.estado] || data.estado}.`;
}

function renderOrderNotification(event) {
    const data = event.datos || {};
    const subject = subjectFor(event);
    const greeting = escapeHtml(data.nombre || 'Cliente');

    if (event.tipo === 'RIFA_GANADOR') {
        const number = escapeHtml(data.numero || '—');
        const title = escapeHtml(data.titulo || 'Sorteo de regalos');
        const selectedAt = data.seleccionadoEn
            ? new Date(data.seleccionadoEn).toLocaleString('es-CO')
            : 'fecha pendiente de confirmar';
        const safeDate = escapeHtml(selectedAt);
        const htmlContent = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5"><main style="max-width:620px;margin:auto;padding:24px"><h2 style="color:#d85c32">Tienda Galindez</h2><p>Hola, ${greeting}.</p><h1 style="color:#7b2cbf">¡Felicitaciones!</h1><p>Tu número de participación fue seleccionado como ganador del sorteo <strong>${title}</strong>.</p><p style="font-size:24px"><strong>Número ganador: #${number}</strong></p><p>Selección realizada el ${safeDate}.</p><p>Conserva este correo y contacta a la tienda para coordinar la entrega del premio.</p><p>Consulta el resultado público en <a href="${escapeHtml((process.env.BASE_URL || 'http://localhost:3000') + '/sorteo')}">la página del sorteo</a>.</p></main></body></html>`;
        const textContent = `Hola, ${data.nombre || 'Cliente'}.\n\n¡Felicitaciones! Tu número de participación #${data.numero} ganó el sorteo "${data.titulo || 'Sorteo de regalos'}".\nSelección realizada el ${selectedAt}.\n\nContacta a Tienda Galindez para coordinar la entrega del premio.`;
        return { subject, htmlContent, textContent };
    }

    const number = escapeHtml(data.numeroOrden || 'Pedido');
    const status = escapeHtml(data.estadoLabel || STATUS_LABELS[data.estado] || data.estado || 'Pendiente');
    const message = messageFor(event);
    const items =
        Array.isArray(data.productos) && data.productos.length
            ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">${data.productos
                  .map(
                      (item) =>
                          `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.nombre)} × ${item.cantidad}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(item.subtotal))}</td></tr>`
                  )
                  .join('')}</table>`
            : '';
    const address = [data.direccion?.direccion, data.direccion?.ciudad, data.direccion?.departamento]
        .filter(Boolean)
        .map(escapeHtml)
        .join(', ');
    const addressBlock = address ? `<p><strong>Entrega:</strong> ${address}</p>` : '';
    const htmlContent = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5"><main style="max-width:620px;margin:auto;padding:24px"><h2 style="color:#d85c32">Tienda Galindez</h2><p>Hola, ${greeting}.</p><p>${escapeHtml(message)}</p><p><strong>Pedido:</strong> ${number}<br><strong>Estado:</strong> ${status}</p>${items}${addressBlock}<p style="font-size:18px"><strong>Total: ${escapeHtml(money(data.total))}</strong></p><p>Consulta el estado desde <a href="${escapeHtml((process.env.BASE_URL || 'http://localhost:3000') + '/mis-pedidos')}">Mis pedidos</a>.</p></main></body></html>`;
    const textContent = `Hola, ${data.nombre || 'Cliente'}.\n\n${message}\nPedido: ${data.numeroOrden || 'Pedido'}\nEstado: ${data.estadoLabel || data.estado || 'Pendiente'}\nTotal: ${money(data.total)}\n\nConsulta el estado en Mis pedidos.`;
    return { subject, htmlContent, textContent };
}

module.exports = { STATUS_LABELS, renderOrderNotification };
