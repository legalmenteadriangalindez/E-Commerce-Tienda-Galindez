const { getUserProfile } = require('../controller/user_controller');

exports.profile = async (req, res) => {
    try {
        const userId = req.user?.id || req.session?.user?._id;
        console.log("USER SESSION:", req.session.user);
        console.log("USER AUTH:", req.user);
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await getUserProfile(userId);

        if (!user) {
            return res.status(404).send("Usuario no encontrado");
        }

        const role = user.rol?.nombre || "Cliente";

        const view = role === "Admin"
            ? "admin/profile/profile"
            : "client/profile/profile";

        return res.render(view, { user });

    } catch (err) {
        console.error("Error perfil:", err);
        return res.status(500).send("Error cargando perfil");
    }
};