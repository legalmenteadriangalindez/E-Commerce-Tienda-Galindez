'use strict';

const { once } = require('node:events');
const { Zip, ZipPassThrough } = require('fflate');

const MAX_ZIP_BYTES = 0xffffffff;

/**
 * Escribe archivos dentro de un ZIP sin cargarlos completos en memoria.
 * fflate construye el formato ZIP (encabezados, CRC y directorio de archivos).
 * Esta clase solo conecta los CSV con la respuesta HTTP.
 */
class ZipWriter {
    constructor(writable) {
        this.writable = writable;
        this.pending = Promise.resolve();
        this.outputBytes = 0;
        this.finished = false;
        this.error = null;

        this.zip = new Zip((error, chunk) => {
            if (error) {
                this.error = error;
                return;
            }
            if (this.error) return;

            this.outputBytes += chunk.length;
            if (this.outputBytes > MAX_ZIP_BYTES) {
                this.error = new Error('El ZIP supera 4 GiB. Usa el respaldo técnico para volúmenes mayores.');
                return;
            }

            // Esperar cuando el navegador recibe los datos más despacio que MongoDB.
            this.pending = this.pending
                .then(async () => {
                    if (this.writable.destroyed) throw new Error('La descarga fue interrumpida.');
                    if (!this.writable.write(Buffer.from(chunk))) await once(this.writable, 'drain');
                })
                .catch((writeError) => {
                    this.error = writeError;
                });
        });
    }

    async flush() {
        await this.pending;
        if (this.error) throw this.error;
    }

    async add(name, source) {
        if (this.finished || !/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) {
            throw new Error('Nombre o estado de archivo ZIP inválido.');
        }

        const file = new ZipPassThrough(name);
        this.zip.add(file);
        let fileBytes = 0;

        for await (const value of source) {
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            fileBytes += chunk.length;
            if (fileBytes > MAX_ZIP_BYTES) throw new Error('Un archivo del ZIP supera 4 GiB.');
            file.push(chunk);
            await this.flush();
        }

        // Un bloque vacío marca el final de este archivo dentro del ZIP.
        file.push(new Uint8Array(0), true);
        await this.flush();
    }

    async finalize() {
        if (this.finished) throw new Error('El archivo ya está finalizado.');
        this.finished = true;
        this.zip.end();
        await this.flush();
        this.writable.end();
    }
}

module.exports = { ZipWriter };
