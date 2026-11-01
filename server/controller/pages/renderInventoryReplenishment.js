'use strict';

const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const replenishment = require('../../business/replenishmentService');

exports.index = wrap(async (req, res) => {
    const result = await replenishment.list(req.query);
    return res.render('admin/inventory/replenishment', {
        ...result,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
