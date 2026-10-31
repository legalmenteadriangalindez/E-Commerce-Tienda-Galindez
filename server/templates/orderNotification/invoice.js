const {
    addressParts,
    escapeHtml,
    formatDate,
    formatHeaderText,
    formatMoney,
    formatText,
    publicUrl,
    renderEmailDocument,
} = require('./shared');

const PAYMENT_LABELS = {
    WOMPI_CARD: 'Tarjeta (Wompi)',
    WOMPI_NEQUI: 'Nequi (Wompi)',
    CASH_ON_DELIVERY: 'Efectivo contra entrega',
    CASH_AT_COUNTER: 'Efectivo en caja',
};

function subjectForInvoice(data) {
    const number = formatHeaderText(data.numeroOrden || 'de tu pedido');
    return `Factura digital ${number} - Tienda Galindez`;
}

function renderInvoice(data) {
    const date = formatDate(data.fecha, new Date().toLocaleString('es-CO'));
    const paymentMethod = PAYMENT_LABELS[data.metodoPago] || data.metodoPago || 'Pendiente';
    const payment = escapeHtml(paymentMethod);
    const paymentStatus = escapeHtml(data.estadoPago || 'PENDIENTE');
    const products = Array.isArray(data.productos) ? data.productos : [];
    const rows = products
        .map(
            (item) => `<tr>
                <td style="padding:10px 6px;border-bottom:1px solid #eee">${escapeHtml(item.nombre)} × ${escapeHtml(item.cantidad)}</td>
                <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatMoney(item.precioUnitario))}</td>
                <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(formatMoney(item.subtotal))}</td>
            </tr>`
        )
        .join('');
    const address = addressParts(data.direccion).map(escapeHtml).join(', ');
    const addressBlock = address ? `<p><strong>Dirección de entrega:</strong> ${address}</p>` : '';
    const content = `
        <header style="border-bottom:3px solid #d85c32;padding-bottom:14px">
            <h1 style="color:#d85c32;margin:0">Tienda Galindez</h1>
            <p style="margin:6px 0 0;color:#6d5148">Factura digital / comprobante de compra</p>
        </header>
        <p>Hola, ${escapeHtml(data.nombre || 'Cliente')}.</p>
        <p>Gracias por tu compra. Conserva este correo como comprobante digital de tu pedido.</p>
        <section style="background:#fff;padding:16px;border:1px solid #eadbd2;border-radius:10px">
            <p style="margin:0">
                <strong>Pedido:</strong> ${escapeHtml(data.numeroOrden || 'Pedido')}<br>
                <strong>Fecha:</strong> ${escapeHtml(date)}<br>
                <strong>Medio de pago:</strong> ${payment}<br>
                <strong>Estado del pago:</strong> ${paymentStatus}
            </p>
        </section>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0">
            <thead><tr>
                <th style="text-align:left;padding:10px 6px;border-bottom:2px solid #d85c32">Producto</th>
                <th style="text-align:right;padding:10px 6px;border-bottom:2px solid #d85c32">Precio</th>
                <th style="text-align:right;padding:10px 6px;border-bottom:2px solid #d85c32">Subtotal</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${addressBlock}
        <table role="presentation" style="width:100%;max-width:360px;margin-left:auto;border-collapse:collapse">
            <tr><td style="padding:5px">Subtotal</td><td style="padding:5px;text-align:right">${escapeHtml(formatMoney(data.subtotal))}</td></tr>
            <tr><td style="padding:5px">Envío</td><td style="padding:5px;text-align:right">${escapeHtml(formatMoney(data.costoEnvio))}</td></tr>
            <tr><td style="padding:5px">Descuento</td><td style="padding:5px;text-align:right">-${escapeHtml(formatMoney(data.descuento))}</td></tr>
            <tr><td style="padding:10px 5px;border-top:2px solid #311b14;font-size:18px"><strong>Total</strong></td><td style="padding:10px 5px;border-top:2px solid #311b14;text-align:right;font-size:18px"><strong>${escapeHtml(formatMoney(data.total))}</strong></td></tr>
        </table>
        <p style="margin-top:24px">Puedes consultar el seguimiento en <a href="${publicUrl('/mis-pedidos')}">Mis pedidos</a>.</p>
        <p style="color:#6d5148;font-size:12px">Este correo es un comprobante digital generado por Tienda Galindez.</p>
    `;
    const htmlContent = renderEmailDocument(content, { maxWidth: '680px', background: '#fffaf6' });
    const textContent = [
        'Factura digital - Tienda Galindez',
        `Pedido: ${formatText(data.numeroOrden || 'Pedido')}`,
        `Fecha: ${date}`,
        `Cliente: ${formatText(data.nombre || 'Cliente')}`,
        `Medio de pago: ${paymentMethod}`,
        `Estado del pago: ${formatText(data.estadoPago, 'PENDIENTE')}`,
        '',
        ...products.map(
            (item) => `${formatText(item.nombre)} x ${formatText(item.cantidad)}: ${formatMoney(item.subtotal)}`
        ),
        '',
        `Subtotal: ${formatMoney(data.subtotal)}`,
        `Envío: ${formatMoney(data.costoEnvio)}`,
        `Descuento: -${formatMoney(data.descuento)}`,
        `Total: ${formatMoney(data.total)}`,
    ].join('\n');

    return { subject: subjectForInvoice(data), htmlContent, textContent };
}

module.exports = { PAYMENT_LABELS, renderInvoice, subjectForInvoice };
