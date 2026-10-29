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
    if (event.tipo === 'FACTURA_PEDIDO')
        return `Factura digital ${order.numeroOrden || 'de tu pedido'} - Tienda Galindez`;
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

function renderInvoice(data, subject) {
    const greeting = escapeHtml(data.nombre || 'Cliente');
    const invoiceNumber = escapeHtml(data.numeroOrden || 'Pedido');
    const date = data.fecha ? new Date(data.fecha).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    const safeDate = escapeHtml(date);
    const paymentLabels = {
        WOMPI_CARD: 'Tarjeta (Wompi)',
        WOMPI_NEQUI: 'Nequi (Wompi)',
        CASH_ON_DELIVERY: 'Efectivo contra entrega',
        CASH_AT_COUNTER: 'Efectivo en caja',
    };
    const payment = escapeHtml(paymentLabels[data.metodoPago] || data.metodoPago || 'Pendiente');
    const paymentStatus = escapeHtml(data.estadoPago || 'PENDIENTE');
    const rows = Array.isArray(data.productos)
        ? data.productos
              .map(
                  (item) =>
                      `<tr><td style="padding:10px 6px;border-bottom:1px solid #eee">${escapeHtml(item.nombre)} × ${item.cantidad}</td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(item.precioUnitario))}</td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(item.subtotal))}</td></tr>`
              )
              .join('')
        : '';
    const address = [data.direccion?.direccion, data.direccion?.ciudad, data.direccion?.departamento]
        .filter(Boolean)
        .map(escapeHtml)
        .join(', ');
    const addressBlock = address ? `<p><strong>Dirección de entrega:</strong> ${address}</p>` : '';
    const htmlContent = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5;background:#fffaf6"><main style="max-width:680px;margin:auto;padding:28px"><header style="border-bottom:3px solid #d85c32;padding-bottom:14px"><h1 style="color:#d85c32;margin:0">Tienda Galindez</h1><p style="margin:6px 0 0;color:#6d5148">Factura digital / comprobante de compra</p></header><p>Hola, ${greeting}.</p><p>Gracias por tu compra. Conserva este correo como comprobante digital de tu pedido.</p><section style="background:#fff;padding:16px;border:1px solid #eadbd2;border-radius:10px"><p style="margin:0"><strong>Pedido:</strong> ${invoiceNumber}<br><strong>Fecha:</strong> ${safeDate}<br><strong>Medio de pago:</strong> ${payment}<br><strong>Estado del pago:</strong> ${paymentStatus}</p></section><table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0"><thead><tr><th style="text-align:left;padding:10px 6px;border-bottom:2px solid #d85c32">Producto</th><th style="text-align:right;padding:10px 6px;border-bottom:2px solid #d85c32">Precio</th><th style="text-align:right;padding:10px 6px;border-bottom:2px solid #d85c32">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>${addressBlock}<table role="presentation" style="width:100%;max-width:360px;margin-left:auto;border-collapse:collapse"><tr><td style="padding:5px">Subtotal</td><td style="padding:5px;text-align:right">${escapeHtml(money(data.subtotal))}</td></tr><tr><td style="padding:5px">Envío</td><td style="padding:5px;text-align:right">${escapeHtml(money(data.costoEnvio))}</td></tr><tr><td style="padding:5px">Descuento</td><td style="padding:5px;text-align:right">-${escapeHtml(money(data.descuento))}</td></tr><tr><td style="padding:10px 5px;border-top:2px solid #311b14;font-size:18px"><strong>Total</strong></td><td style="padding:10px 5px;border-top:2px solid #311b14;text-align:right;font-size:18px"><strong>${escapeHtml(money(data.total))}</strong></td></tr></table><p style="margin-top:24px">Puedes consultar el seguimiento en <a href="${escapeHtml((process.env.BASE_URL || 'http://localhost:3000') + '/mis-pedidos')}">Mis pedidos</a>.</p><p style="color:#6d5148;font-size:12px">Este correo es un comprobante digital generado por Tienda Galindez.</p></main></body></html>`;
    const textContent = [
        `Factura digital - Tienda Galindez`,
        `Pedido: ${data.numeroOrden || 'Pedido'}`,
        `Fecha: ${date}`,
        `Cliente: ${data.nombre || 'Cliente'}`,
        `Medio de pago: ${paymentLabels[data.metodoPago] || data.metodoPago || 'Pendiente'}`,
        `Estado del pago: ${data.estadoPago || 'PENDIENTE'}`,
        '',
        ...(Array.isArray(data.productos)
            ? data.productos.map((item) => `${item.nombre} x ${item.cantidad}: ${money(item.subtotal)}`)
            : []),
        '',
        `Subtotal: ${money(data.subtotal)}`,
        `Envío: ${money(data.costoEnvio)}`,
        `Descuento: -${money(data.descuento)}`,
        `Total: ${money(data.total)}`,
    ].join('\n');
    return { subject, htmlContent, textContent };
}

function renderOrderNotification(event) {
    const data = event.datos || {};
    const subject = subjectFor(event);
    const greeting = escapeHtml(data.nombre || 'Cliente');
    if (event.tipo === 'FACTURA_PEDIDO') return renderInvoice(data, subject);

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
