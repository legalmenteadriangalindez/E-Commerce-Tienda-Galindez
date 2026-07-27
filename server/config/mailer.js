const nodemailer = require('nodemailer');
const dns = require('dns');

// ========================================
// FORZAR RESOLUCIÓN DNS A IPv4
// ========================================

dns.setDefaultResultOrder('ipv4first');

console.log('========== CONFIGURACIÓN SMTP ==========');
console.log('SMTP HOST: smtp.gmail.com');
console.log('SMTP PORT: 587');
console.log('SMTP SECURE: false');
console.log('SMTP REQUIRE TLS: true');
console.log('EMAIL_USER configurado:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS configurado:', !!process.env.EMAIL_PASS);
console.log('=========================================');


// ========================================
// TRANSPORTER
// ========================================

const transporter = nodemailer.createTransport({

    host: 'smtp.gmail.com',

    port: 587,

    // false = STARTTLS
    secure: false,

    // Exigir conexión TLS
    requireTLS: true,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },

    // Timeouts
    connectionTimeout: 30000,

    greetingTimeout: 30000,

    socketTimeout: 30000
});


// ========================================
// VERIFICAR CONEXIÓN SMTP
// ========================================

transporter.verify((error, success) => {

    if (error) {

        console.error(
            '❌ Error conectando con Gmail SMTP'
        );

        console.error(
            'Mensaje:',
            error.message
        );

        console.error(
            'Código:',
            error.code
        );

        console.error(
            'Comando:',
            error.command
        );

        console.error(
            'Respuesta:',
            error.response
        );

    } else {

        console.log(
            '✅ Gmail SMTP configurado correctamente'
        );

    }

});


// ========================================
// EXPORTAR TRANSPORTER
// ========================================

module.exports = transporter;
