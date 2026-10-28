'use strict';

// Índices existentes de la aplicación. Esta migración es el punto de partida
// para bases ya creadas y para instalaciones nuevas. Los cambios posteriores
// deben añadir otro archivo versionado; no se debe editar una migración aplicada.
const indexes = [
    ['orderdbs', { numeroOrden: 1 }, { unique: true }],
    ['orderdbs', { usuario: 1 }],
    ['orderdbs', { estado: 1 }],
    ['orderdbs', { createdAt: -1 }],
    ['orderdbs', { createdAt: -1, _id: -1 }],
    ['orderdbs', { canal: 1, _id: 1 }],
    ['orderdbs', { inventario: 1, reservaHasta: 1 }],
    ['orderdbs', { repartidor: 1, estado: 1, createdAt: -1 }],
    ['orderdbs', { usuario: 1, canal: 1 }, {
        unique: true,
        partialFilterExpression: { canal: 'WOMPI', inventario: 'RESERVADO' }
    }],
    ['orderdbs', { claveCheckout: 1 }, {
        unique: true,
        partialFilterExpression: { claveCheckout: { $type: 'string' } }
    }],
    ['orderdbs', { wompiTransactionId: 1 }, {
        unique: true,
        partialFilterExpression: { wompiTransactionId: { $type: 'string' } }
    }],
    ['orderdbs', { claveIdempotenciaCaja: 1 }, {
        unique: true,
        partialFilterExpression: { claveIdempotenciaCaja: { $type: 'string' } }
    }],

    ['saledbs', { order: 1 }, { unique: true }],
    ['saledbs', { estadoPago: 1, createdAt: -1 }],
    ['saledetaildbs', { venta: 1, createdAt: 1, _id: 1 }],
    ['saledetaildbs', { producto: 1, venta: 1 }],

    ['productdbs', { fechaIngreso: -1, _id: -1 }],
    ['productdbs', { stock: 1, nombre: 1 }],
    ['productdbs', { categoria: 1, fechaIngreso: -1 }],
    ['productdbs', { marca: 1, fechaIngreso: -1 }],
    ['categorydbs', { nombre: 1 }, { unique: true }],
    ['branddbs', { nombre: 1 }, { unique: true }],
    ['providerdbs', { nombre: 1, _id: 1 }],
    ['roldbs', { nombre: 1 }, { unique: true }],
    ['userdbs', { email: 1 }, { unique: true }],
    ['userdbs', { estado: 1, fechaRegistro: -1, _id: -1 }],
    ['userdbs', { rol: 1, estado: 1 }],

    ['paymentevents', { transactionId: 1 }, { unique: true }],
    ['paymentevents', { estado: 1, updatedAt: 1 }],
    ['reviewdbs', { claveAutorProducto: 1 }, { unique: true, sparse: true }],
    ['reviewdbs', { producto: 1, fecha: -1, _id: -1 }],
    ['reviewdbs', { producto: 1, usuario: 1 }],
    ['reviewdbs', { oculta: 1, fecha: -1, _id: -1 }],
    ['raffledbs', { clave: 1 }, { unique: true }],
    ['raffleentrydbs', { raffle: 1, order: 1 }, { unique: true }],
    ['raffleentrydbs', { raffle: 1, numero: 1 }, { unique: true }],
    ['raffleentrydbs', { raffle: 1, createdAt: -1 }],
    ['security_rate_limits', { expiresAt: 1 }, { expireAfterSeconds: 0 }],
    ['orderemailevents', { clave: 1 }, { unique: true }],
    ['orderemailevents', { estado: 1, proximoIntento: 1, createdAt: 1 }],
    ['orderemailevents', { order: 1, createdAt: 1 }]
];

async function up({ db }) {
    for (const [collectionName, keys, options = {}] of indexes) {
        // createIndex es idempotente cuando la clave y sus opciones coinciden.
        // Si una base tiene un índice incompatible, MongoDB falla y la
        // migración no se marca como aplicada para poder corregirlo con una
        // operación revisada, sin borrar índices automáticamente.
        await db.collection(collectionName).createIndex(keys, options);
    }
}

module.exports = {
    id: '202610280001-bootstrap-indexes',
    description: 'Crea los índices declarados actualmente por la tienda.',
    indexes,
    up
};
