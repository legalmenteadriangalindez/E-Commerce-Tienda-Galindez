const test = require('node:test');
const assert = require('node:assert/strict');
const { compareSnapshots } = require('../scripts/verify-gridfs-restore');

function snapshot(overrides = {}) {
    return {
        collections: { files: true, chunks: true },
        fileCount: 1,
        chunkCount: 1,
        totalBytes: 4,
        files: [
            {
                id: '507f1f77bcf86cd799439011',
                filename: 'imagen.webp',
                length: 4,
                chunkSize: 261120,
                uploadDate: '2026-10-30T00:00:00.000Z',
                metadata: { contentType: 'image/webp' },
                bytes: 4,
                sha256: 'hash',
            },
        ],
        indexes: {
            files: [{ key: { filename: 1, uploadDate: 1 }, name: 'filename_1_uploadDate_1', unique: false }],
            chunks: [{ key: { files_id: 1, n: 1 }, name: 'files_id_1_n_1', unique: true }],
        },
        ...overrides,
    };
}

test('la verificación de GridFS detecta una restauración completa', () => {
    const result = compareSnapshots(snapshot(), snapshot(), 'media');
    assert.equal(result.passed, true);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.expectedCollections, ['media.files', 'media.chunks']);
});

test('la verificación de GridFS detecta archivos o contenido alterado', () => {
    const target = snapshot({
        chunkCount: 2,
        files: [
            {
                ...snapshot().files[0],
                sha256: 'otro-hash',
            },
        ],
    });
    const result = compareSnapshots(snapshot(), target, 'media');
    assert.equal(result.passed, false);
    assert.match(result.failures.join(' '), /chunks|sha256/);
});
