const { publicError, errorStatus } = require('./publicError');

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const catalogPagination = require('./catalogPagination');

// Configuración para enviar la sesión a nuestra API
function configApi(req) {
    return {
        headers: {
            Cookie: req.headers.cookie || "",
            'X-CSRF-Token': req.session?.csrfToken || ''
        },
        timeout: 10000
    };
}


// ==================== FORMULARIO CREAR USUARIO ====================

exports.create_user_form = async (req, res) => {
    try {
        const rolesRes = await axios.get(
            `${BASE_URL}/api/roles`,
            configApi(req)
        );

        res.render('admin/users/add_user', {
            roles: rolesRes.data
        });

    } catch (err) {
        res.status(errorStatus(err)).send(publicError(err));
    }
};


// ==================== CREAR USUARIO ====================

exports.add_user = async (req, res) => {
    try {
        if (
            !req.body.nombre ||
            !req.body.email ||
            !req.body.telefono ||
            !req.body.direccion
        ) {
            return res.status(400).json({
                message: "Nombre, email, teléfono y dirección son obligatorios."
            });
        }

        await axios.post(
            `${BASE_URL}/api/users`,
            req.body,
            configApi(req)
        );

        res.redirect('/read-user');

    } catch (err) {
        res.status(500).send(
            err.response?.data || err.message
        );
    }
};


// ==================== LISTAR USUARIOS ====================

exports.read_users = async (req, res) => {
    try {
        const response = await axios.get(
            `${BASE_URL}/api/users`,
            {
                ...configApi(req),
                params: {
                    adminList: '1',
                    page: req.query.page || 1,
                    limit: 10
                }
            }
        );

        const payload = response.data;
        return res.render("admin/users/read_users", {
            users: payload.items || payload,
            pagination: catalogPagination.buildPagination(req, payload.pagination || {
                page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
            })
        });

    } catch (error) {
        console.error(
            "Error consultando usuarios:",
            error.message
        );

        return res.status(502).send(
            "No se pudo consultar la lista de usuarios"
        );
    }
};


// ==================== FORMULARIO EDITAR USUARIO ====================

exports.update_user = async (req, res) => {
    try {
        const userRes = await axios.get(
            `${BASE_URL}/api/users/${req.params.id}`,
            configApi(req)
        );

        const rolesRes = await axios.get(
            `${BASE_URL}/api/roles`,
            configApi(req)
        );

        res.render('admin/users/update_user', {
            user: userRes.data,
            roles: rolesRes.data
        });

    } catch (err) {
        res.send(
            err.response?.data || err.message
        );
    }
};


// ==================== ACTUALIZAR USUARIO ====================

exports.update_user_data = async (req, res) => {
    try {
        const id = req.params.id;

        const body = {
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            genero: req.body.genero,
            barrio: req.body.barrio,
            ciudad: req.body.ciudad,
            puntoReferencia: req.body.puntoReferencia,
            estado: req.body.estado,
            rol: req.body.rol
        };

        // Solo actualizar la contraseña cuando se proporciona
        if (
            req.body.password &&
            req.body.password.trim() !== ""
        ) {
            body.password = req.body.password;
        }

        await axios.put(
            `${BASE_URL}/api/users/${id}`,
            body,
            configApi(req)
        );

        res.redirect('/read-user');

    } catch (err) {
        res.status(errorStatus(err)).send(publicError(err));
    }
};


// ==================== DESACTIVAR USUARIO ====================

exports.delete_user = (req, res) => {
    axios.delete(
        `${BASE_URL}/api/users/${req.params.id}`,
        configApi(req)
    )
        .then(response => {
            res.redirect('/read-user');
        })
        .catch(err => {
            res.status(errorStatus(err)).send(publicError(err));
        });
};
