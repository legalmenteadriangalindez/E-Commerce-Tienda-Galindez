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
        // redirección por rol
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
        if (!nombre || !email || !password || !telefono || !direccion || !genero || !barrio || !ciudad || !puntoReferencia || !ubicacion) {
            return res.send("Campos obligatorios incompletos");
        }

        if (password.length < 6) {
            return res.send("La contraseña debe tener mínimo 6 caracteres");
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
            ubicacion,
            rol: rolCliente._id
        });
        await nuevoUsuario.save();
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
        return res.redirect('/');
    } catch (err) {
        
        res.status(500).send("Error en registro");
    }
};
