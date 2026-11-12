'use strict';

const { once } = require('node:events');

const MAX_ZIP_BYTES = 0xffffffff;
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    CRC_TABLE[n] = crc >>> 0;
}

function updateCrc(value, buffer) {
    let crc = value;
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return crc >>> 0;
}

class ZipWriter {
    constructor(writable) {
        this.writable = writable;
        this.position = 0;
        this.files = [];
        this.finished = false;
    }

    async write(value) {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (this.position + buffer.length > MAX_ZIP_BYTES) {
            throw new Error('El ZIP excede el tamaño máximo del formato. Usa respaldo técnico para volúmenes mayores.');
        }
        this.position += buffer.length;
        if (!this.writable.write(buffer)) await once(this.writable, 'drain');
    }

    async add(name, source) {
        if (this.finished || !/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) {
            throw new Error('Nombre o estado de archivo ZIP inválido.');
        }
        const filename = Buffer.from(name, 'utf8');
        const offset = this.position;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0808, 6);
        local.writeUInt16LE(0, 8); // Método STORE: streaming sin archivos temporales.
        local.writeUInt16LE(filename.length, 26);
        await this.write(local);
        await this.write(filename);

        let crc = 0xffffffff;
        let size = 0;
        for await (const value of source) {
            const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
            crc = updateCrc(crc, buffer);
            size += buffer.length;
            if (size > MAX_ZIP_BYTES) throw new Error('Un archivo del ZIP supera 4 GiB.');
            await this.write(buffer);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const descriptor = Buffer.alloc(16);
        descriptor.writeUInt32LE(0x08074b50, 0);
        descriptor.writeUInt32LE(crc, 4);
        descriptor.writeUInt32LE(size, 8);
        descriptor.writeUInt32LE(size, 12);
        await this.write(descriptor);
        this.files.push({ filename, offset, crc, size });
    }

    async finalize() {
        if (this.finished) throw new Error('El archivo ya está finalizado.');
        const centralOffset = this.position;
        for (const entry of this.files) {
            const header = Buffer.alloc(46);
            header.writeUInt32LE(0x02014b50, 0);
            header.writeUInt16LE(20, 4);
            header.writeUInt16LE(20, 6);
            header.writeUInt16LE(0x0808, 8);
            header.writeUInt16LE(0, 10);
            header.writeUInt32LE(entry.crc, 16);
            header.writeUInt32LE(entry.size, 20);
            header.writeUInt32LE(entry.size, 24);
            header.writeUInt16LE(entry.filename.length, 28);
            header.writeUInt32LE(entry.offset, 42);
            await this.write(header);
            await this.write(entry.filename);
        }
        const centralSize = this.position - centralOffset;
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(this.files.length, 8);
        end.writeUInt16LE(this.files.length, 10);
        end.writeUInt32LE(centralSize, 12);
        end.writeUInt32LE(centralOffset, 16);
        await this.write(end);
        this.finished = true;
        this.writable.end();
    }
}

module.exports = { ZipWriter, updateCrc };
