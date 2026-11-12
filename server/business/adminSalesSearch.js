const mongoose = require('mongoose');
const Order = require('../model/order');
const User = require('../model/user');
const { BusinessError } = require('./errors');

function normalizeSearch(value) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string' || value.trim().length > 100)
        throw new BusinessError('La búsqueda debe contener máximo 100 caracteres.');
    return value.trim();
}

function searchPattern(value) {
    const literal = normalizeSearch(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(literal, 'i');
}

function salesSearchMatch(search) {
    const pattern = searchPattern(search);
    const choices = [
        { 'order.numeroOrden': pattern },
        { 'order.cliente.nombre': pattern },
        { 'order.cliente.email': pattern },
        { 'order.cliente.telefono': pattern },
        { 'searchCustomer.nombre': pattern },
        { 'searchCustomer.email': pattern },
        { 'searchCustomer.telefono': pattern },
        { 'searchCustomer.cedula': pattern },
    ];
    if (mongoose.isObjectIdOrHexString(search)) choices.push({ _id: new mongoose.Types.ObjectId(search) });
    return { $or: choices };
}

function salesPipeline(filters) {
    const match = {};
    if (filters.status) match.estadoPago = filters.status;
    if (filters.from || filters.to) {
        match.createdAt = {};
        if (filters.from) match.createdAt.$gte = filters.from;
        if (filters.to) match.createdAt.$lt = filters.to;
    }
    const pipeline = [
        { $match: match },
        { $sort: { createdAt: -1, _id: -1 } },
        {
            $lookup: {
                from: Order.collection.name,
                localField: 'order',
                foreignField: '_id',
                as: 'order',
            },
        },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    ];
    if (filters.channel) pipeline.push({ $match: { 'order.canal': filters.channel } });

    if (filters.search) {
        pipeline.push(
            {
                $lookup: {
                    from: User.collection.name,
                    localField: 'cliente',
                    foreignField: '_id',
                    as: 'searchCustomer',
                },
            },
            { $unwind: { path: '$searchCustomer', preserveNullAndEmptyArrays: true } },
            { $match: salesSearchMatch(filters.search) }
        );
    }
    return pipeline;
}

async function orderSearchFilter(value) {
    const search = normalizeSearch(value);
    if (!search) return {};
    const pattern = searchPattern(search);
    const customers = await User.find({
        $or: [{ nombre: pattern }, { email: pattern }, { telefono: pattern }, { cedula: pattern }],
    })
        .select('_id')
        .lean();
    const choices = [
        { numeroOrden: pattern },
        { 'cliente.nombre': pattern },
        { 'cliente.email': pattern },
        { 'cliente.telefono': pattern },
        { usuario: { $in: customers.map((customer) => customer._id) } },
    ];
    if (mongoose.isObjectIdOrHexString(search)) choices.push({ _id: new mongoose.Types.ObjectId(search) });
    return { $or: choices };
}

module.exports = { normalizeSearch, searchPattern, salesSearchMatch, salesPipeline, orderSearchFilter };
