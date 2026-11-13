const INCIDENT_TYPES = Object.freeze([
    'CLIENTE_AUSENTE',
    'DIRECCION_INCORRECTA',
    'CLIENTE_RECHAZO',
    'PEDIDO_DANADO',
    'NO_SE_PUDO_COBRAR',
    'PEDIDO_DEVUELTO',
    'SEGUNDA_VISITA',
]);

const INCIDENT_LABELS = Object.freeze({
    CLIENTE_AUSENTE: 'Cliente ausente',
    DIRECCION_INCORRECTA: 'Dirección incorrecta',
    CLIENTE_RECHAZO: 'Cliente rechazó el pedido',
    PEDIDO_DANADO: 'Pedido dañado',
    NO_SE_PUDO_COBRAR: 'No se pudo cobrar',
    PEDIDO_DEVUELTO: 'Pedido devuelto',
    SEGUNDA_VISITA: 'Requiere segunda visita',
});

const INCIDENT_STATUS = Object.freeze({
    OPEN: 'ABIERTA',
    RESOLVED: 'RESUELTA',
});

const INCIDENT_STATUSES = Object.freeze(Object.values(INCIDENT_STATUS));

const INCIDENT_STATUS_LABELS = Object.freeze({
    ABIERTA: 'Abierta',
    RESUELTA: 'Resuelta',
});

module.exports = {
    INCIDENT_TYPES,
    INCIDENT_LABELS,
    INCIDENT_STATUS,
    INCIDENT_STATUSES,
    INCIDENT_STATUS_LABELS,
};
