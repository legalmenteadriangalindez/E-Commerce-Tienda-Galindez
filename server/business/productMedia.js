'use strict';

const media = require('./mediaService');
const { BusinessError } = require('./errors');

function uploadedFiles(files) {
    return Array.isArray(files) ? files : Object.values(files || {}).flat();
}

async function discardUploads(files) {
    const results = await Promise.allSettled(uploadedFiles(files).map((file) => media.removeUnused(file.url)));
    for (const result of results) {
        if (result.status === 'rejected')
            console.error('No se pudo limpiar una imagen sin uso:', result.reason.message);
    }
}

// Operación pura: permite probar reemplazos sin cargar imágenes ni MongoDB.
function updatedPhotos(original, input, files = {}) {
    const remove = input.eliminarFotos ? [].concat(input.eliminarFotos) : [];
    if (remove.some((photo) => !original.includes(photo)))
        throw new BusinessError('Fotografía no pertenece al producto.');
    for (const field of Object.keys(files)) {
        if (!field.startsWith('foto_')) continue;
        const index = Number(field.slice(5));
        if (!Number.isInteger(index) || index < 0 || index >= original.length)
            throw new BusinessError('Índice de fotografía inválido.');
    }
    const result = [];
    original.forEach((photo, index) => {
        const replacement = files[`foto_${index}`]?.[0];
        if (remove.includes(photo) && replacement)
            throw new BusinessError('No puedes eliminar y reemplazar la misma foto a la vez.');
        if (!remove.includes(photo)) result.push(replacement?.url || photo);
    });
    result.push(...(files.nuevasFotos || []).map((file) => file.url));
    if (result.length > 4) throw new BusinessError('Máximo 4 fotografías por producto.');
    return result;
}

module.exports = { uploadedFiles, discardUploads, updatedPhotos };
