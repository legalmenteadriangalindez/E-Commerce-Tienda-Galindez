const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const sendEmail = require('../config/sendEmail');

exports.verificationCode = async (req, res) => {
    try {
        const email = req.body.email?.trim();
        const code  = req.body.code?.trim();
        console.log("EMAIL:", `[${email}]`);
        console.log("CODE:", `[${code}]`);
        const user = await Userdb.findOne({email});
        if (!user) {
            return res.status(404).send("Usuario no encontrado");
        }
        if (!user.verificationCode || !user.verificationExpire) {
            return res.status(400).send("No hay código activo");
        }
        if(user.verificationCode !== code){
            return res.status(400).send("Código de verificación incorrecto");
        }
        if(user.verificationExpire < new Date()){
            return res.status(400).send("Código de verificación expirado");
        }
        user.verified = true;
        user.estado = "Activo";
        user.verificationCode = null;
        user.verificationExpire = null;
        await user.save();
        return res.redirect('/login');
    }catch(error){
        res.status(500).send("Error al verificar el código de verificación");
    }
};

exports.resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Userdb.findOne({email});
        if (!user) {
            return res.status(404).send("Usuario no encontrado");
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const ExpirationTime = new Date(Date.now() + 10 * 60 * 1000);
        await sendEmail(user.email, code);
        user.verificationCode = code;
        user.verificationExpire = ExpirationTime;
        await user.save();
        return res.redirect(`/verify-email?email=${email}`);
    }catch(error){
        res.status(500).send("Error al reenviar el código de verificación");
    }
}