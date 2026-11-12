'use strict';

const mongoose = require('mongoose');
const { ZipWriter } = require('../services/zipWriter');

const DEFINITIONS = require('./businessDataExportDefinitions');

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
