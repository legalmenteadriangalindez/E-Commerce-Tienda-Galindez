const OrderEmailEvent = require('../model/orderEmailEvent');
const sendEmail = require('../config/sendEmail');
const { renderInvoicePdf } = require('../services/invoicePdf');
const { renderOrderNotification } = require('../templates/orderNotification');
const { safeFilename, text } = require('./emailNotificationUtils');

const MAX_ATTEMPTS = 8;
const STALE_CLAIM_MS = 15 * 60 * 1000;

async function buildNotification(event) {
    const notification = renderOrderNotification(event);
    if (event?.tipo !== 'FACTURA_PEDIDO') return notification;

    const pdf = await renderInvoicePdf(event.datos);
    notification.attachment = [
        {
            content: pdf.toString('base64'),
            name: `factura-${safeFilename(event.datos?.numeroOrden)}.pdf`,
        },
    ];
    return notification;
}

async function processPending(limit = 10) {
    const now = new Date();
    await OrderEmailEvent.updateMany(
        { estado: 'ENVIANDO', ultimoIntento: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        { $set: { estado: 'FALLIDO', proximoIntento: now, error: 'El envío anterior quedó interrumpido.' } }
    );

    let processed = 0;
    while (processed < limit) {
        const event = await OrderEmailEvent.findOneAndUpdate(
            {
                estado: { $in: ['PENDIENTE', 'FALLIDO'] },
                intentos: { $lt: MAX_ATTEMPTS },
                $or: [{ proximoIntento: { $exists: false } }, { proximoIntento: { $lte: now } }],
            },
            { $set: { estado: 'ENVIANDO', ultimoIntento: new Date() }, $inc: { intentos: 1 } },
            { sort: { createdAt: 1 }, new: true, lean: true }
        );
        if (!event) break;

        processed += 1;
        try {
            const notification = await buildNotification(event);
            const result = await sendEmail.sendOrderNotification(event, notification);
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                {
                    $set: {
                        estado: 'ENVIADO',
                        enviadoEn: new Date(),
                        messageId: String(result?.messageId || '').slice(0, 200),
                        error: '',
                    },
                    $unset: { proximoIntento: 1 },
                }
            );
        } catch (error) {
            const attempts = Number(event.intentos) || 1;
            const delay = Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempts - 1, 6));
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                {
                    $set: {
                        estado: 'FALLIDO',
                        proximoIntento: new Date(Date.now() + delay),
                        error: text(error.message, 'No se pudo enviar el correo.'),
                    },
                }
            );
            console.error(
                JSON.stringify({
                    event: 'order_email_failed',
                    emailEventId: event._id,
                    order: event.order,
                    type: event.tipo,
                    attempts,
                    message: text(error.message, 'No se pudo enviar el correo.'),
                })
            );
        }
    }

    return processed;
}

module.exports = { MAX_ATTEMPTS, buildNotification, processPending };
