const nodeMailer = require('nodemailer');

const transporter = nodeMailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verificar conexión con Gmail
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

console.log('📧 EMAIL_USER configurado:', !!process.env.EMAIL_USER);
console.log('🔑 EMAIL_PASS configurado:', !!process.env.EMAIL_PASS);

module.exports = transporter;
