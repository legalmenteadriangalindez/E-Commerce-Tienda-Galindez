const queue = require('./emailNotificationQueue');
const worker = require('./emailNotificationWorker');
const { renderOrderNotification } = require('../templates/orderNotification');

module.exports = {
    ...queue,
    ...worker,
    renderOrderNotification,
};
