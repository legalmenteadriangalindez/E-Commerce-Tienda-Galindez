// Los servicios web y los procesos programados deben inicializar las mismas
// colecciones e índices antes de ejecutar operaciones de negocio.
const models = Object.freeze([
    require('../model/order'),
    require('../model/sales'),
    require('../model/paymentEvent'),
    require('../model/review'),
    require('../model/raffle'),
    require('../model/raffleEntry'),
    require('../model/rateLimitBucket'),
    require('../model/orderEmailEvent')
]);

async function initializeModels() {
    await Promise.all(models.map(model => model.init()));
}

module.exports = { initializeModels };
