const service = require('../business/userService');
const { wrap } = require('../http/handlers');
exports.create = wrap(async (req, res) => res.status(201).json(await service.create(req.body, req.usuarioActual)));
exports.find = wrap(async (req, res) => res.json(await service.find(req.query, req.usuarioActual, req.params.id)));
exports.update = wrap(async (req, res) => res.json(await service.update(req.params.id, req.body, req.usuarioActual)));
exports.delete = wrap(async (req, res) => {
    await service.remove(req.params.id, req.usuarioActual);
    res.json({ message: 'Usuario marcado como inactivo.' });
});
exports.search = wrap(async (req, res) => res.json(await service.search(req.query, req.usuarioActual)));
exports.roleChangeError = service.roleChangeError;
