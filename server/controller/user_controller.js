const Userdb = require('../model/user');
const bcrypt = require('bcrypt');

// CREATE USER

exports.create = async (req, res) => {
    try {
        
        let { nombre, email,password, telefono, direccion, genero, barrio, ciudad, puntoReferencia, ubicacion } = req.body;

        // Validar campos obligatorios
        if (!nombre || !email || !telefono || !direccion || !password) {
            return res.status(400).json({
                message: "Nombre, email, teléfono, dirección y contraseña son obligatorios."
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                message: "La contraseña debe tener al menos 6 caracteres."
            });
        }
        // Normalizar email
        email = email.toLowerCase();

        // Validar formato de email simple
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Email inválido." });
        }

        // Validar teléfono simple (solo números y mínimo 7 dígitos)
        const telefonoRegex = /^\d{7,15}$/;
        if (!telefonoRegex.test(telefono)) {
            return res.status(400).json({ message: "Teléfono inválido. Debe tener solo números y al menos 7 dígitos." });
        }

        // Validar ubicación
        if (ubicacion) {
            const { lat, lng } = ubicacion;
            if (lat == null || lng == null) {
                return res.status(400).json({ message: "Ubicación incompleta. Debe incluir lat y lng." });
            }
        }
        const hash = await bcrypt.hash(password, 10);// Hash de la contraseña
        const user = new Userdb({
            nombre,
            email,
            password: hash, // Guardar el hash de la contraseña
            telefono,
            genero,
            direccion,
            barrio,
            ciudad: ciudad || "Timbio",
            puntoReferencia,
            ubicacion,
            estado: "Activo"
        });

        const data = await user.save();
        const userResponse = data.toObject();
        delete userResponse.password;
        res.status(201).json(userResponse);

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "El email ya existe." });
        }
        res.status(500).json({ message: err.message || "Error creando el usuario." });
    }
};

// FIND USERS

exports.find = async (req, res) => {
    try {
        if (req.params.id) {
            const data = await Userdb.findById(req.params.id);
            if (!data) return res.status(404).json({ message: "Usuario no encontrado." });
            return res.json(data);
        } else {
            const users = await Userdb.find({ estado: "Activo" }); // Solo activos
            return res.json(users);
        }
    } catch (err) {
        res.status(500).json({ message: err.message || "Error al obtener los usuarios." });
    }
};

// UPDATE USER
exports.update = async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ message: "Datos vacíos, nada que actualizar." });
        }

        // Solo permitir ciertos campos para actualizar
        const allowedFields = ['nombre', 'telefono', 'direccion', 'genero', 'barrio', 'ciudad', 'puntoReferencia', 'ubicacion', 'estado'];
        const updateData = {};
        for (let key of allowedFields) {
            if (req.body[key] !== undefined) updateData[key] = req.body[key];
        }

        // Normalizar email si se actualiza (opcional)
        if (req.body.email) updateData.email = req.body.email.toLowerCase();

        const data = await Userdb.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
        if (!data) return res.status(404).json({ message: "Usuario no encontrado." });

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message || "Error actualizando el usuario." });
    }
};

exports.update_user = async (req, res) => {
    try {

        const id = req.params.id;

        const response = await axios.get(`http://localhost:3000/api/users/${id}`);

        const user = response.data;

        res.render('update_user', { user });

    } catch (err) {
        console.error("ERROR UPDATE USER:", err.message);
        res.send(err.message);
    }
};

// DELETE USER (BORRADO LÓGICO)
exports.delete = async (req, res) => {
    try {
        const data = await Userdb.findByIdAndUpdate(
            req.params.id,
            { $set: { estado: "Inactivo" } },
            { new: true }
        );
        if (!data) return res.status(404).json({ message: "Usuario no encontrado." });

        res.json({ message: "Usuario marcado como inactivo." });
    } catch (err) {
        res.status(500).json({ message: err.message || "Error eliminando el usuario." });
    }
};


// SEARCH USERS (NUEVO)
exports.search = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();

        if (!search) {
            return res.json([]);
        }

        const users = await Userdb.find({
            estado: "Activo",
            $or: [
                { nombre: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { telefono: { $regex: search, $options: "i" } }
            ]
        }).limit(10);

        return res.json(users);

    } catch (err) {
        console.error("ERROR SEARCH USERS:", err);
        return res.status(500).json({
            message: "Error buscando usuarios",
            error: err.message
        });
    }
};

// PERFIL DEL USUARIO LOGUEADO

exports.getUserProfile = async (userId) => {
    if (!userId) return null;

    const user = await Userdb.findById(userId).populate('rol');

    return user;
};