const PRODUCTS_PER_PAGE = 12;

function buildPagination(req, metadata = {}) {
    const totalItems = Math.max(0, Number(metadata.totalItems) || 0);
    const totalPages = Math.max(0, Number(metadata.totalPages) || 0);
    const currentPage = Math.max(
        1,
        Math.min(Number(metadata.page) || 1, totalPages || 1)
    );
    const limit = Math.max(1, Number(metadata.limit) || PRODUCTS_PER_PAGE);
    const queryWithoutPage = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query || {})) {
        if (key === 'page' || typeof value !== 'string') continue;
        queryWithoutPage.set(key, value);
    }

    const pathname = (req.originalUrl || req.path || '/')
        .split('?')[0];

    const pageUrl = page => {
        const query = new URLSearchParams(queryWithoutPage);
        query.set('page', String(page));
        return `${pathname}?${query.toString()}`;
    };

    const firstPageInWindow = Math.max(
        1,
        Math.min(currentPage - 3, totalPages - 6)
    );
    const lastPageInWindow = Math.min(totalPages, firstPageInWindow + 6);
    const pages = [];

    for (let page = firstPageInWindow; page <= lastPageInWindow; page += 1) {
        pages.push({
            number: page,
            href: pageUrl(page),
            current: page === currentPage
        });
    }

    return {
        currentPage,
        totalPages,
        totalItems,
        from: totalItems ? ((currentPage - 1) * limit) + 1 : 0,
        to: Math.min(currentPage * limit, totalItems),
        pages,
        previousUrl: currentPage > 1 ? pageUrl(currentPage - 1) : null,
        nextUrl: currentPage < totalPages ? pageUrl(currentPage + 1) : null
    };
}

module.exports = {
    PRODUCTS_PER_PAGE,
    buildPagination
};
