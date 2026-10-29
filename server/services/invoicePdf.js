const PDFDocument = require('pdfkit');

function valueText(value, fallback = '—') {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
}

function money(value) {
    if (typeof value === 'string' && value.trim()) return value;
    return Number(value || 0).toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    });
}

function renderInvoicePdf(data = {}) {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument({
            size: 'A4',
            margin: 48,
            info: {
                Title: `Factura digital ${valueText(data.numeroOrden, 'Pedido')}`,
                Author: 'Tienda Galindez',
                Subject: 'Factura digital / comprobante de compra',
            },
        });
        const chunks = [];

        document.on('data', (chunk) => chunks.push(chunk));
        document.on('error', reject);
        document.on('end', () => resolve(Buffer.concat(chunks)));

        const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
        const accent = '#d85c32';
        const ink = '#311b14';
        const muted = '#6d5148';
        let y = document.page.margins.top;

        function ensureSpace(height = 28) {
            if (y + height <= document.page.height - document.page.margins.bottom) return;
            document.addPage();
            y = document.page.margins.top;
        }

        function labelValue(label, value, width = pageWidth) {
            ensureSpace(20);
            document.font('Helvetica-Bold').fontSize(9).fillColor(ink).text(`${label}:`, 48, y, {
                width: 110,
                continued: true,
            });
            document
                .font('Helvetica')
                .fillColor(ink)
                .text(` ${valueText(value)}`, {
                    width: width - 110,
                });
            y = document.y + 4;
        }

        document.font('Helvetica-Bold').fontSize(24).fillColor(accent).text('Tienda Galindez');
        y = document.y + 3;
        document.font('Helvetica').fontSize(11).fillColor(muted).text('Factura digital / comprobante de compra');
        y = document.y + 9;
        document
            .moveTo(48, y)
            .lineTo(48 + pageWidth, y)
            .lineWidth(2)
            .strokeColor(accent)
            .stroke();
        y += 18;

        document.font('Helvetica-Bold').fontSize(15).fillColor(ink).text('Factura de venta');
        y = document.y + 7;
        labelValue('Pedido', data.numeroOrden);
        labelValue(
            'Fecha',
            data.fecha ? new Date(data.fecha).toLocaleString('es-CO') : new Date().toLocaleString('es-CO')
        );
        labelValue('Cliente', data.nombre);
        labelValue('Correo', data.email);
        labelValue('Medio de pago', data.metodoPago);
        labelValue('Estado del pago', data.estadoPago);

        const address = [data.direccion?.direccion, data.direccion?.ciudad, data.direccion?.departamento]
            .filter(Boolean)
            .join(', ');
        if (address) labelValue('Entrega', address);
        if (data.direccion?.referencia) labelValue('Referencia', data.direccion.referencia);

        ensureSpace(54);
        y += 5;
        document.rect(48, y, pageWidth, 24).fill('#f8e9e1');
        document.font('Helvetica-Bold').fontSize(9).fillColor(ink);
        document.text('Producto', 56, y + 8, { width: 245 });
        document.text('Cant.', 306, y + 8, { width: 45, align: 'right' });
        document.text('Precio', 357, y + 8, { width: 80, align: 'right' });
        document.text('Subtotal', 442, y + 8, { width: 98, align: 'right' });
        y += 30;

        const products = Array.isArray(data.productos) ? data.productos : [];
        products.forEach((item) => {
            ensureSpace(34);
            const rowY = y;
            document.font('Helvetica').fontSize(9).fillColor(ink);
            document.text(valueText(item.nombre, 'Producto'), 56, rowY, { width: 245, height: 22 });
            document.text(valueText(item.cantidad, '0'), 306, rowY, { width: 45, align: 'right' });
            document.text(money(item.precioUnitario), 357, rowY, { width: 80, align: 'right' });
            document.text(money(item.subtotal), 442, rowY, { width: 98, align: 'right' });
            y = Math.max(document.y, rowY + 13) + 8;
            document
                .moveTo(48, y - 4)
                .lineTo(48 + pageWidth, y - 4)
                .lineWidth(0.5)
                .strokeColor('#eadbd2')
                .stroke();
        });

        if (!products.length) {
            document.font('Helvetica').fontSize(9).fillColor(muted).text('No hay productos registrados.', 56, y);
            y = document.y + 12;
        }

        ensureSpace(122);
        y += 14;
        const summaryX = 315;
        const summaryWidth = 243;
        const summaryLine = (label, value, strong = false) => {
            document
                .font(strong ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(strong ? 12 : 10)
                .fillColor(ink);
            document.text(label, summaryX, y, { width: 115 });
            document.text(value, summaryX + 115, y, { width: summaryWidth - 115, align: 'right' });
            y = document.y + (strong ? 9 : 5);
        };
        summaryLine('Subtotal', money(data.subtotal));
        summaryLine('Envío', money(data.costoEnvio));
        summaryLine('Descuento', `-${money(data.descuento)}`);
        document
            .moveTo(summaryX, y)
            .lineTo(summaryX + summaryWidth, y)
            .lineWidth(1)
            .strokeColor(ink)
            .stroke();
        y += 9;
        summaryLine('Total', money(data.total), true);

        ensureSpace(44);
        y += 18;
        document.font('Helvetica').fontSize(9).fillColor(muted).text('Gracias por comprar en Tienda Galindez.', 48, y, {
            width: pageWidth,
            align: 'center',
        });
        y = document.y + 4;
        document.text('Este documento es un comprobante digital generado automáticamente.', 48, y, {
            width: pageWidth,
            align: 'center',
        });

        document.end();
    });
}

module.exports = { renderInvoicePdf };
