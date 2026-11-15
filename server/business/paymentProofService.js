const Order = require('../model/order');
const { hasPermission } = require('../config/authorization');
const { PERMISSIONS: P } = require('../config/permissions');

function isAssignedDealer(user, order) {
    return user?.rol?.nombre === 'dealer' && order?.repartidor && String(order.repartidor) === String(user._id);
}

async function findAuthorizedOrder(mediaId, user) {
    const order = await Order.findOne({
        $or: [
            { 'revisionPago.comprobanteFoto.mediaId': mediaId },
            { 'historialPago.comprobanteFoto.mediaId': mediaId },
        ],
    })
        .select('_id repartidor')
        .lean();

    if (!order) return null;

    const canReadAsAdmin = hasPermission(user, P.PAYMENTS_READ);
    const canReadAsAssignedDealer = isAssignedDealer(user, order);
    return canReadAsAdmin || canReadAsAssignedDealer ? order : null;
}

async function isPrivateMediaId(mediaId) {
    return Boolean(
        await Order.exists({
            $or: [
                { 'revisionPago.comprobanteFoto.mediaId': mediaId },
                { 'historialPago.comprobanteFoto.mediaId': mediaId },
            ],
        })
    );
}

module.exports = { findAuthorizedOrder, isPrivateMediaId };
