const pagination = require('../services/adminPagination');

// Las páginas y las API utilizan la misma consulta acotada.
module.exports = async function queryPage(Model, query = {}, options = {}) {
    const { page, limit } = pagination.requested(query, 10);
    const filter = options.filter || {};
    const totalItems = await Model.countDocuments(filter);
    const metadata = pagination.metadata(page, limit, totalItems);
    let cursor = Model.find(filter).sort(options.sort || { nombre: 1, _id: 1 });
    if (options.select) cursor = cursor.select(options.select);
    for (const population of options.populate || []) cursor = cursor.populate(...population);
    const items = await cursor
        .skip((metadata.page - 1) * limit)
        .limit(limit)
        .lean();
    return { items, pagination: metadata };
};
