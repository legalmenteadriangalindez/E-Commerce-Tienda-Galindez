const service = require('../business/providerService');
const { wrap } = require('../http/handlers');
exports.create = wrap(async (req, res) => {
    const value = await service.create(req.body);

    return res.status(201).json(value);
});
exports.find = wrap(async (req, res) => {
    const id = req.params.id || req.query.id;
    if (id) return res.json(await service.get(id));

    return res.json(await service.list(req.query));
});
exports.update = wrap(async (req, res) => {
    const value = await service.update(req.params.id, req.body);

    return res.json(value);
});
exports.delete = wrap(async (req, res) => {
    await service.remove(req.params.id);
    return res.json({ message: 'Proveedor eliminado correctamente.' });
});
exports.findById = wrap(async (req, res) => res.json(await service.get(req.params.id)));
