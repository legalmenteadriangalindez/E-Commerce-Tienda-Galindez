'use strict';

const mongoose = require('mongoose');
const { ZipWriter } = require('../services/zipWriter');

const DEFINITIONS = Object.freeze([
    {
        file: 'productos.csv',
        model: 'product',
        fields: [
            '_id', 'nombre', 'descripcion', 'precioCosto', 'precioCostoCents', 'precioVenta',
            'precioVentaCents', 'stock', 'stockMinimo', 'proveedor', 'marca', 'categoria',
            'enPromocion', 'fechaIngreso', 'fotos',
        ],
    },
    {
        file: 'categorias.csv',
        model: 'categories',
        fields: ['_id', 'nombre', 'descripcion'],
    },
    {
        file: 'marcas.csv',
        model: 'brands',
        fields: ['_id', 'nombre', 'descripcion'],
    },
    {
        file: 'proveedores.csv',
        model: 'provider',
        fields: ['_id', 'nombre', 'contacto', 'telefono', 'email', 'direccion', 'descripcion', 'diasEntrega'],
    },
    {
        file: 'clientes_usuarios.csv',
        model: 'user',
        // No se incluyen hashes, tokens de recuperación, verificaciones ni versiones de sesión.
        fields: [
            '_id', 'nombre', 'email', 'telefono', 'cedula', 'genero', 'direccion', 'barrio',
            'ciudad', 'puntoReferencia', 'ubicacion', 'rol', 'estado', 'verified', 'fechaRegistro',
        ],
    },
    {
        file: 'roles.csv',
        model: 'rol',
        fields: ['_id', 'nombre', 'descripcion', 'permisos'],
    },
    {
        file: 'pedidos.csv',
        model: 'order',
        fields: [
            '_id', 'numeroOrden', 'usuario', 'cliente', 'productos', 'subtotal', 'subtotalCents',
            'impuestos', 'impuestosCents', 'costoEnvio', 'costoEnvioCents', 'total', 'totalCents',
            'descuento', 'descuentoCents', 'canal', 'metodoPago', 'estadoPago', 'estado',
            'pagoConfirmadoEn', 'inventario', 'reservaHasta', 'direccionEnvio', 'notasCliente',
            'repartidor', 'asignacionReparto', 'seguimientoEntrega', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'ventas.csv',
        model: 'sales',
        fields: [
            '_id', 'cliente', 'order', 'subtotal', 'subtotalCents', 'impuestos', 'impuestosCents',
            'costoEnvio', 'costoEnvioCents', 'descuento', 'descuentoCents', 'total', 'totalCents',
            'estadoPago', 'metodoPago', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'detalles_ventas.csv',
        model: 'saleDetails',
        fields: [
            '_id', 'venta', 'producto', 'cantidad', 'precioUnitario', 'precioUnitarioCents',
            'precioCostoUnitario', 'precioCostoUnitarioCents', 'subtotal', 'subtotalCents',
            'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'movimientos_inventario.csv',
        model: 'inventoryMovement',
        fields: [
            '_id', 'producto', 'tipo', 'cantidad', 'deltaStock', 'stockAntes', 'stockDespues',
            'motivo', 'actor', 'actorNombre', 'pedido', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'gastos.csv',
        model: 'businessExpense',
        fields: [
            '_id', 'categoria', 'descripcion', 'montoCents', 'fechaGasto', 'pagadoEn',
            'creadoPor', 'pagadoPor', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'compras_proveedores.csv',
        model: 'supplierPurchase',
        fields: [
            '_id', 'proveedor', 'producto', 'cantidad', 'costoUnitarioCents', 'totalCents',
            'referencia', 'observacion', 'estado', 'recibidaEn', 'pagadoEn', 'creadoPor',
            'recibidoPor', 'pagadoPor', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'resenas.csv',
        model: 'review',
        fields: [
            '_id', 'producto', 'usuario', 'calificacion', 'comentario', 'respuesta',
            'oculta', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'sorteos.csv',
        model: 'raffle',
        fields: [
            '_id', 'titulo', 'descripcion', 'premio', 'imagenPremio', 'estado', 'fechaInicio',
            'fechaFin', 'ganador', 'createdAt', 'updatedAt',
        ],
    },
    {
        file: 'participaciones_sorteos.csv',
        model: 'raffleEntry',
        fields: ['_id', 'raffle', 'usuario', 'pedido', 'createdAt', 'updatedAt'],
    },
    {
        file: 'configuracion_tienda.csv',
        model: 'storeSetting',
        fields: ['_id', 'clave', 'valor', 'createdAt', 'updatedAt'],
    },
]);

function resolveModels() {
    return DEFINITIONS.map((definition) => {
        const model = require('../model/' + definition.model);
        return { ...definition, collectionName: model.collection.name };
    });
}

function safeValue(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value._bsontype === 'ObjectId') return value.toHexString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function csvCell(value) {
    let string = safeValue(value);
    if (/^[=+@\-\t\r]/.test(string)) string = "'" + string;
    return /[,"\r\n]/.test(string) ? '"' + string.replace(/"/g, '""') + '"' : string;
}

function csvLine(fields) {
    return fields.map(csvCell).join(',') + '\r\n';
}

async function* collectionCsv(db, definition) {
    yield '\uFEFF' + csvLine(definition.fields);
    const projection = Object.fromEntries(definition.fields.map((field) => [field, 1]));
    for await (const doc of db.collection(definition.collectionName).find({}, { projection, batchSize: 200 })) {
        yield csvLine(definition.fields.map((field) => doc[field]));
    }
}

async function exportBusinessZip(db, writable) {
    const zip = new ZipWriter(writable);
    const definitions = resolveModels();
    const description = [
        'Tienda Galíndez - exportación para análisis',
        'Fecha UTC: ' + new Date().toISOString(),
        '',
        'Los CSV incluyen los datos de negocio disponibles al generar la descarga.',
        'Las relaciones se identifican por los campos _id de MongoDB.',
        'Los importes *_Cents están expresados en centavos de peso colombiano.',
        'Las columnas que contienen objetos o listas están en formato JSON.',
        'Los CSV no incluyen contraseñas, hashes, tokens ni sesiones.',
        'Las imágenes binarias almacenadas en GridFS se conservan en el respaldo técnico cifrado.',
        'Esta exportación no sustituye un respaldo técnico restaurable.',
        '',
        'Archivos:',
        ...definitions.map((definition) => ' - ' + definition.file),
        '',
    ].join('\n');
    await zip.add('LEEME.txt', [description]);
    for (const definition of definitions) {
        await zip.add(definition.file, collectionCsv(db, definition));
    }
    await zip.finalize();
    return { tables: definitions.length };
}

module.exports = { DEFINITIONS, csvCell, csvLine, resolveModels, exportBusinessZip };
