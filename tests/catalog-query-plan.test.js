const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../server/business/catalogService');
const Product = require('../server/model/product');
const commerce = require('../server/business/commerceService');
const { summarizeExplain } = require('../server/business/analytics/common');

test(
    'mide búsqueda por subcadena y conserva resultados en una base MongoDB temporal',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const app = await require('./helpers/reviewApp').startReviewApp(process.env.COMMERCE_TEST_MONGO_URI);
        t.after(() => app.close());

        const term = 'needle';
        const termPattern = new RegExp(term, 'i');
        const fixtures = Array.from({ length: 2000 }, (_, index) => {
            const nameMatches = index % 100 === 0;
            const descriptionMatches = index % 173 === 0;
            return {
                nombre: nameMatches ? `Producto needle ${index}` : `Producto estándar ${index}`,
                descripcion: descriptionMatches ? `Detalle needle ${index}` : `Descripción estándar ${index}`,
                fotos: [],
                marca: app.product.marca,
                categoria: app.product.categoria,
                precioCosto: 5000,
                precioVenta: 8000,
                stock: 10,
                fechaIngreso: new Date(1700000000000 + index * 1000),
            };
        });
        const inserted = await Product.insertMany(fixtures);
        const expected = inserted
            .filter((product) => termPattern.test(product.nombre) || termPattern.test(product.descripcion))
            .sort((first, second) => {
                const dateDifference = second.fechaIngreso - first.fechaIngreso;
                if (dateDifference) return dateDifference;
                return String(first._id) < String(second._id) ? 1 : -1;
            });

        const originalFind = Product.find.bind(Product);
        let searchFilter;
        let checkoutProductQueries = 0;
        t.mock.method(Product, 'find', (filter) => {
            if (filter?.$or) searchFilter = filter;
            if (filter?._id?.$in) checkoutProductQueries += 1;
            return originalFind(filter);
        });

        const result = await catalog.listPublic({ search: term, limit: 48 });
        assert.equal(result.pagination.totalItems, expected.length);
        assert.deepEqual(
            result.productos.map((product) => String(product._id)),
            expected.map((product) => String(product._id))
        );

        const plan = await originalFind(searchFilter)
            .select('_id')
            .sort({ fechaIngreso: -1, _id: -1 })
            .limit(48)
            .explain('executionStats');
        const summary = summarizeExplain(plan);
        assert.equal(summary.nReturned, expected.length);
        console.log(
            '[catalog-search-plan]',
            JSON.stringify({
                totalProducts: await Product.countDocuments(),
                matches: expected.length,
                ...summary,
            })
        );

        const cart = inserted.slice(0, 20).map((product) => ({ productoId: product.id, cantidad: 1 }));
        const quote = await commerce.quote(cart);
        assert.equal(quote.productos.length, cart.length);
        assert.equal(checkoutProductQueries, 1);

        const checkoutPlan = await originalFind({ _id: { $in: cart.map((item) => item.productoId) } })
            .select('nombre stock precioVentaCents precioVenta precioCostoCents precioCosto')
            .explain('executionStats');
        const checkoutSummary = summarizeExplain(checkoutPlan);
        assert.equal(checkoutSummary.nReturned, cart.length);
        assert.equal(checkoutSummary.usesCollectionScan, false);
        console.log(
            '[checkout-product-plan]',
            JSON.stringify({
                cartItems: cart.length,
                previousProductQueries: cart.length,
                currentProductQueries: checkoutProductQueries,
                ...checkoutSummary,
            })
        );
    }
);
