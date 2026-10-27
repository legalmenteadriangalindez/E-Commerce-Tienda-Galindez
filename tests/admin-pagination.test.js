const test = require('node:test');
const assert = require('node:assert/strict');
const pagination = require('../server/services/adminPagination');

test('la paginación administrativa normaliza límites y páginas', () => {
    assert.deepEqual(pagination.requested({ page: '3', limit: '100' }), {
        page: 3,
        limit: 50
    });

    assert.deepEqual(pagination.metadata(8, 10, 23), {
        page: 3,
        limit: 10,
        totalItems: 23,
        totalPages: 3
    });

    const largeResult = pagination.metadata(999, 50, 501);
    assert.equal(largeResult.totalItems, 501);
    assert.equal(largeResult.totalPages, 11);
    assert.equal(largeResult.page, 11);

    assert.equal(pagination.isAdminList({ adminList: '1' }), true);
    assert.equal(pagination.isAdminList({ adminList: '0' }), false);
});
