exports.isAdmin = (req, res, next) => {

    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.rol.nombre !== "Admin") {
        return res.status(403).send("Acceso denegado");
    }

    next();
};


exports.isLogged = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};



exports.isAdminApi = (req, res, next) => {

    const usuario = req.session?.user;

    // Verificar que inició sesión
    if (!usuario?._id) {
        return res.status(401).json({
            success: false,
            message: "Debes iniciar sesión"
        });
    }

    // Verificar permisos administrativos
    if (usuario.rol?.nombre !== "Admin") {
        return res.status(403).json({
            success: false,
            message: "No tienes permisos de administrador"
        });
    }

    next();
};



exports.isDealer = (req, res, next) => {

    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.rol.nombre !== "dealer") {
        return res.status(403).send("Acceso denegado");
    }

    next();
};
