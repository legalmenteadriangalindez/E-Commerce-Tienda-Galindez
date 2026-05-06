const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const bcrypt = require('bcrypt');

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
        // guardar sesión
        req.session.user = user;    
        // redirección
        if (user.rol.nombre === "Admin") {
            res.redirect('/billing-point');
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.error(err);
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
        res.redirect('/login');
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
            puntoReferencia
        } = req.body;

        // Validar campos obligatorios
        if (!nombre || !email || !password || !telefono || !direccion) {
            return res.send("Campos obligatorios incompletos");
        }
        // Verificar si ya existe
        const existe = await Userdb.findOne({ email });
        if (existe) {
            return res.send("El email ya está registrado");
        }
        // Buscar rol CLIENTE
        const rolCliente = await Roldb.findOne({ nombre: "Cliente" });
        if (!rolCliente) {
            return res.send("Rol Cliente no existe en la base de datos");
        }
        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        // Crear usuario
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
            rol: rolCliente._id
        });
        await nuevoUsuario.save();
        // Opcional: iniciar sesión automáticamente
        req.session.user = {
            _id: nuevoUsuario._id,
            nombre: nuevoUsuario.nombre,
            rol: {
                nombre: "Cliente"
            }
        };
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error en registro");
    }
};
