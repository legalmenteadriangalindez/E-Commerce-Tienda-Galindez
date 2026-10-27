const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function positiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requested(query = {}, fallbackLimit = DEFAULT_LIMIT) {
    return {
        page: positiveInteger(query.page, 1),
        limit: Math.min(positiveInteger(query.limit, fallbackLimit), MAX_LIMIT)
    };
}

function metadata(pageRequested, limit, totalItems) {
    const safeTotal = Math.max(0, Number(totalItems) || 0);
    const totalPages = Math.ceil(safeTotal / limit);
    const page = Math.min(pageRequested, totalPages || 1);

    return { page, limit, totalItems: safeTotal, totalPages };
}

function isAdminList(query = {}) {
    return String(query.adminList || '') === '1';
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, requested, metadata, isAdminList };
