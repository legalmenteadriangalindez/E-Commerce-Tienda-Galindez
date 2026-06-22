const nodeMailer = require('nodemailer');

const transporter = nodeMailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

console.log("EMAIL_USER:", JSON.stringify(process.env.EMAIL_USER));
console.log("EMAIL_PASS:", JSON.stringify(process.env.EMAIL_PASS));

module.exports = transporter;