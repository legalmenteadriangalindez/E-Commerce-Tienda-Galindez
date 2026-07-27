const nodemailer = require('nodemailer');
const dns = require('dns');

// Obligar a Node.js a preferir IPv4
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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

console.log(
    '📧 EMAIL_USER configurado:',
    !!process.env.EMAIL_USER
);

console.log(
    '🔑 EMAIL_PASS configurado:',
    !!process.env.EMAIL_PASS
);

module.exports = transporter;
