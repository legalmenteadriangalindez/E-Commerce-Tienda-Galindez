// Fachada pública del módulo de entregas.
// Las rutas existentes siguen importando este archivo; las reglas puras y las
// operaciones de persistencia viven en módulos separados para mantener una
// única API compatible.
const rules = require('./deliveryRules');
const operations = require('./deliveryOperations');

module.exports = {
    ...rules,
    ...operations,
};
