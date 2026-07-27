const nodemailer = require('nodemailer');
const dns = require('dns');

// Obligar a Node.js a preferir IPv4
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    port: 587,

    // STARTTLS
    secure: false,
    requireTLS: true,

    // Forzar conexión mediante IPv4
    family: 4,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
        // Configuración de conexión
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
});

// Verificar conexión SMTP
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Error conectando con Gmail SMTP');
        console.error('Mensaje:', error.message);
        console.error('Código:', error.code);
        console.error('Comando:', error.command);
        console.error('Respuesta:', error.response);
    } else {
        console.log('✅ Gmail SMTP configurado correctamente');
    }
});

// Verificar variables de entorno
console.log(
    '📧 EMAIL_USER configurado:',
    !!process.env.EMAIL_USER
);

console.log(
    '🔑 EMAIL_PASS configurado:',
    !!process.env.EMAIL_PASS
);

module.exports = transporter;
