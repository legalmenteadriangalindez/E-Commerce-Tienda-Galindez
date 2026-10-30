const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const adminPagination = require('../services/adminPagination');
const rules = require('./userRules');

function findRoleByName(name) {
    return Roldb.findOne({ nombre: name });
}

function findRoleIdByName(name) {
    return Roldb.findOne({ nombre: name }).select('_id').lean();
}

function findRoleById(id) {
    return Roldb.findById(id).select('nombre');
}

function findById(id) {
    return Userdb.findById(id).populate('rol', 'nombre');
}

function findByIdForAdmin(id) {
    return Userdb.findById(id).select(rules.CAMPOS_USUARIO_ADMIN).populate('rol', 'nombre');
}

async function listActive(filter, query = {}) {
    const { page, limit } = adminPagination.requested(query, 10);
    const totalItems = await Userdb.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const users = await Userdb.find(filter)
        .select(rules.CAMPOS_USUARIO_ADMIN)
        .populate('rol', 'nombre')
        .sort({ fechaRegistro: -1, _id: -1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    return { items: users, pagination };
}

function create(data) {
    return new Userdb(data).save();
}

function updateById(id, update) {
    return Userdb.findByIdAndUpdate(id, update, { new: true, runValidators: true })
        .select(rules.CAMPOS_USUARIO_ADMIN)
        .populate('rol', 'nombre');
}

function deactivate(id) {
    return Userdb.findByIdAndUpdate(id, { $set: { estado: 'Inactivo' } }, { new: true });
}

function search(filter) {
    return Userdb.find(filter).select(rules.CAMPOS_USUARIO_ADMIN).limit(10);
}

module.exports = {
    findRoleByName,
    findRoleIdByName,
    findRoleById,
    findById,
    findByIdForAdmin,
    listActive,
    create,
    updateById,
    deactivate,
    search,
};
