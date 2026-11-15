// Fachada interna de operaciones de reparto.
// Mantiene la API histórica mientras cada grupo de responsabilidades vive en
// un módulo pequeño y comprobable.
const queries = require('./deliveryQueries');
const assignments = require('./deliveryAssignments');
const incidents = require('./deliveryIncidents');
const dashboard = require('./deliveryDashboard');

module.exports = {
    ...queries,
    ...assignments,
    ...incidents,
    ...dashboard,
};
