'use strict';

const { BrevoClient } = require('@getbrevo/brevo');
const sendEmail = require('../server/config/sendEmail');
const notifications = require('../server/business/emailNotificationService');

function required(name) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Falta la variable ${name}.`);
    return value;
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function smokeOrder(email) {
    return {
        _id: 'brevo-smoke-order',
        numeroOrden: `BREVO-SMOKE-${Date.now()}`,
        createdAt: new Date(),
        cliente: { nombre: 'Prueba Brevo', email },
        subtotal: 40000,
        costoEnvio: 5000,
        descuento: 0,
        total: 45000,
        estado: 'PAGADA',
        estadoPago: 'PAGADO',
        metodoPago: 'CASH_ON_DELIVERY',
        direccionEnvio: { direccion: 'Calle de prueba 1', ciudad: 'Timbío', departamento: 'Cauca' },
        productos: [{ nombre: 'Producto de prueba', cantidad: 2, precioUnitario: 20000, subtotal: 40000 }],
    };
}

function eventFor(type, data) {
    const states = {
        PEDIDO_RECIBIDO: { estado: 'PAGADA', estadoPago: 'PAGADO' },
        CAMBIO_ESTADO: { estado: 'PREPARANDO', estadoPago: 'PAGADO' },
        AVISO_ENVIO: { estado: 'ENVIADA', estadoPago: 'PAGADO' },
        AVISO_ENTREGA: { estado: 'ENTREGADA', estadoPago: 'PAGADO' },
    };
    return {
        _id: `brevo-smoke-${type.toLowerCase()}`,
        tipo: type,
        destinatario: { nombre: data.nombre, email: data.email },
        datos: {
            ...data,
            ...states[type],
            tipo: type,
            estadoLabel: notifications.STATUS_LABELS[states[type]?.estado] || states[type]?.estado,
        },
    };
}

function errorMessage(error) {
    const status = error?.statusCode || error?.status;
    return status ? `Brevo respondió HTTP ${status}.` : error?.message || 'Error desconocido de Brevo.';
}

async function send(label, operation) {
    try {
        const result = await operation();
        console.log(`${label}: OK${result?.messageId ? ` (${result.messageId})` : ''}`);
        return result;
    } catch (error) {
        throw new Error(`${label}: ${errorMessage(error)}`);
    }
}

async function main() {
    const apiKey = required('BREVO_API_KEY');
    const sender = required('EMAIL_USER');
    const recipient = required('BREVO_SMOKE_EMAIL');
    const confirmation = process.env.BREVO_SMOKE_CONFIRM?.trim();

    if (!validEmail(sender) || !validEmail(recipient))
        throw new Error('EMAIL_USER y BREVO_SMOKE_EMAIL deben ser correos válidos.');
    if (confirmation !== 'YES') {
        throw new Error('Para enviar la prueba debes definir BREVO_SMOKE_CONFIRM=YES.');
    }

    // La consulta de cuenta no envía ningún mensaje y detecta de inmediato
    // claves inválidas antes de ejecutar el lote de pruebas.
    const client = new BrevoClient({ apiKey });
    await client.account.getAccount();
    console.log('Credenciales Brevo: OK');

    const order = smokeOrder(recipient);
    const data = notifications.snapshotOrder(order);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    await send('Verificación de cuenta', () => sendEmail(recipient, '123456'));
    await send('Recuperación de contraseña', () =>
        sendEmail.sendPasswordReset(recipient, `${baseUrl}/reset-password?token=${'a'.repeat(64)}`)
    );

    for (const type of ['PEDIDO_RECIBIDO', 'CAMBIO_ESTADO', 'AVISO_ENVIO', 'AVISO_ENTREGA', 'FACTURA_PEDIDO']) {
        const event = eventFor(type, data);
        const notification = await notifications.buildNotification(event);
        await send(type, () => sendEmail.sendOrderNotification(event, notification));
        if (type === 'FACTURA_PEDIDO') {
            if (!notification.attachment?.[0]?.name.endsWith('.pdf'))
                throw new Error('La factura no generó un adjunto PDF.');
            console.log(`Factura PDF: ${notification.attachment[0].name}`);
        }
    }

    console.log(`Smoke test completado. Revisa ${recipient} y la carpeta de spam.`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Smoke test falló: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { eventFor, smokeOrder, main };
