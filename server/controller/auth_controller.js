const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const bcrypt = require('bcrypt');
const sendEmail = require('../config/sendEmail');

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); 
}

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await Userdb
            .findOne({ email })
            .populate('rol');
        if (!user) {
            return res.send("Usuario no encontrado");
        }
        if (user.estado !== "Activo") {
            return res.send("Usuario desactivado");
        }
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.send("Contraseña incorrecta");
        }
        req.session.user = user;    

        if (user.rol.nombre === "Admin") {

            return res.redirect('/billing-point');

        } else if (user.rol.nombre === "dealer") {

            return res.redirect('/dealer/orders/read');

        } else {

            return res.redirect('/');

        }
    } catch (err) {
        
        res.status(500).send("Error en login");
    }
};

// LOGOUT
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid'); // nombre por defecto de la cookie de express-session
        if (err) {
            return res.send("Error al cerrar sesión");
        }
        return res.redirect('/login');
    });
};



// ======================= REGISTER =======================
exports.register = async (req, res) => {
    try {
        const {
            nombre,
            email,
            password,
            telefono,
            direccion,
            genero,
            barrio,
            ciudad,
            puntoReferencia,
            ubicacion
        } = req.body;

        // Validar campos obligatorios
        if (!nombre || !email || !password || !telefono || !direccion || !genero || !barrio || !ciudad || !puntoReferencia ) {
            return res.send("Campos obligatorios incompletos");
        }

        if (password.length < 6) {
            return res.send("La contraseña debe tener mínimo 6 caracteres");
        }
        // Verificar si ya existe
        const existe = await Userdb.findOne({ email });
        console.log("Usuario encontrado:", existe);
        if (existe) {
            // await Userdb.deleteOne({email: "adriangalindez2419@gmail.com"});
            if (!existe.verified) {
                const code = generateCode();
                const ExpirationTime = new Date(Date.now() + 10 * 60 * 1000);
                existe.verificationCode = code;
                existe.verificationExpire = ExpirationTime;
                await existe.save();
                await sendEmail(existe.email, code);
                return res.redirect(`/verify-email?email=${email}`);
            }else{
                return res.redirect("/login");
            }
        }
        

        // Buscar rol CLIENTE
        const rolCliente = await Roldb.findOne({ nombre: "Cliente" });
        if (!rolCliente) {
            return res.send("Rol Cliente no existe en la base de datos");
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        // Crear usuario

        const code = generateCode();
        const ExpirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
        const nuevoUsuario = new Userdb({
            nombre,
            email,
            password: hashedPassword,
            telefono,
            direccion,
            genero,
            barrio,
            ciudad,
            puntoReferencia,
            ubicacion,
            verified: false,
            verificationCode: code,
            verificationExpire: ExpirationTime,
            rol: rolCliente._id
        });
        await nuevoUsuario.save();
        await sendEmail(nuevoUsuario.email, code);
        
        // Opcional: iniciar sesión automáticamente
        req.session.user = {
            _id: nuevoUsuario._id,
            nombre: nuevoUsuario.nombre,
            email: nuevoUsuario.email,
            telefono: nuevoUsuario.telefono,
            direccion: nuevoUsuario.direccion,
            ubicacion: nuevoUsuario.ubicacion,
            ciudad: nuevoUsuario.ciudad,
            rol: {
                nombre: "Cliente"
            }
        };
        return res.redirect(`/verify-email?email=${email}`);
    } catch (err) {
        
        res.status(500).send("Error en registro");
    }
};
