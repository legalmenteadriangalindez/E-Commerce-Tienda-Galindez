const service = require('../business/brandService');
const { wrap } = require('../http/handlers');
exports.create = wrap(async (req, res) => {
    const value = await service.create(req.body, req.file);
    if (!req.is('application/json')) return res.redirect('/admin/brands/read-brands');
    return res.status(201).json(value);
});
exports.find = wrap(async (req, res) => {
    const id = req.params.id || req.query.id;
    if (id) return res.json(await service.get(id));
    if (String(req.query.adminList) !== '1') return res.json(await service.publicList());
    return res.json(await service.list(req.query));
});
exports.update = wrap(async (req, res) => {
    const value = await service.update(req.params.id, req.body, req.file);
    if (!req.is('application/json')) return res.redirect('/admin/brands/read-brands');
    return res.json(value);
});
exports.delete = wrap(async (req, res) => {
    await service.remove(req.params.id);
    return res.json({ message: 'Marca eliminado correctamente.' });
});
exports.findOne = wrap(async (req, res) => res.json(await service.byName(req.params.nombre)));
