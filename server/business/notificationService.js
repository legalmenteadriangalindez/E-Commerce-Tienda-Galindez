// La cola y el transporte de correo permanecen en emailNotificationService.
// Este módulo ofrece el punto de entrada del dominio para no acoplar los
// flujos de pedidos y pagos a los detalles del proveedor de correo.
module.exports = require('./emailNotificationService');
