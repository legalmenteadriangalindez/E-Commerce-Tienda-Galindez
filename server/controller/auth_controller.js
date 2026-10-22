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

        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).send(
                "Correo y contraseña requeridos"
            );
        }

        const usuario = await Userdb.findOne({
            email: email.trim()
        }).populate("rol", "nombre");

        // Respuesta genérica para evitar revelar
        // información sobre cuentas existentes
        if (
            !usuario ||
            usuario.estado !== "Activo" ||
            !usuario.rol?.nombre
        ) {
            return res.status(401).send(
                "Credenciales inválidas"
            );
        }

        const passwordValida = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!passwordValida) {
            return res.status(401).send(
                "Credenciales inválidas"
            );
        }

        // Conservar el carrito de la sesión anterior
        const carritoAnterior = Array.isArray(req.session.cart)
            ? req.session.cart
            : [];

        // Crear un nuevo ID de sesión al iniciar sesión
        return req.session.regenerate((error) => {

            if (error) {
                return res.status(500).send(
                    "No se pudo iniciar sesión"
                );
            }

            // Guardar únicamente datos necesarios
            req.session.user = {
                _id: usuario._id.toString(),
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                direccion: usuario.direccion,
                ciudad: usuario.ciudad,
                ubicacion: usuario.ubicacion,
                rol: {
                    nombre: usuario.rol.nombre
                }
            };

            req.session.cart = carritoAnterior;

            req.session.save((error) => {

                if (error) {
                    return res.status(500).send(
                        "No se pudo guardar la sesión"
                    );
                }

                if (usuario.rol.nombre === "Admin") {
                    return res.redirect("/billing-point");
                }

                if (usuario.rol.nombre === "dealer") {
                    return res.redirect("/dealer/orders/read");
                }

                return res.redirect("/");
            });
        });

    } catch (error) {
        console.error("Error en login:", error.message);

        return res.status(500).send(
            "No se pudo iniciar sesión"
        );
    }
};


// LOGOUT

exports.logout = (req, res) => {

    if (!req.session) {
        return res.redirect("/login");
    }

    req.session.destroy((error) => {

        if (error) {
            return res.status(500).send(
                "No se pudo cerrar sesión"
            );
        }

        res.clearCookie("tienda.sid");

        return res.redirect("/login");
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
        // req.session.user = {
        //     _id: nuevoUsuario._id,
        //     nombre: nuevoUsuario.nombre,
        //     email: nuevoUsuario.email,
        //     telefono: nuevoUsuario.telefono,
        //     direccion: nuevoUsuario.direccion,
        //     ubicacion: nuevoUsuario.ubicacion,
        //     ciudad: nuevoUsuario.ciudad,
        //     rol: {
        //         nombre: "Cliente"
        //     }
        // };
        return res.redirect(`/verify-email?email=${email}`);
    } catch (err) {
        
        res.status(500).send("Error en registro");
    }
};
