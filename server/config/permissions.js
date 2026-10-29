const PERMISSIONS = Object.freeze({
    ADMIN_ACCESS: 'admin:access',
    CATALOG_READ: 'catalog:read',
    CATALOG_WRITE: 'catalog:write',
    INVENTORY_READ: 'inventory:read',
    ORDERS_READ: 'orders:read',
    ORDERS_MANAGE: 'orders:manage',
    PAYMENTS_READ: 'payments:read',
    PAYMENTS_MANAGE: 'payments:manage',
    STORE_SETTINGS_MANAGE: 'store-settings:manage',
    SALES_READ: 'sales:read',
    ANALYTICS_READ: 'analytics:read',
    REVIEWS_MODERATE: 'reviews:moderate',
    RAFFLE_MANAGE: 'raffle:manage',
    DELIVERY_MANAGE: 'delivery:manage',
    PROVIDERS_MANAGE: 'providers:manage',
    USERS_MANAGE: 'users:manage',
    ROLES_MANAGE: 'roles:manage',
    PROFILE_MANAGE: 'profile:manage',
});

// Roles reservados de la aplicación. No deben poder crearse, renombrarse ni
// eliminarse desde el panel. `SuperAdmin` es la cuenta de emergencia y la
// única que puede delegar o retirar ese nivel de acceso.
const SYSTEM_ROLES = Object.freeze({
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Admin',
    CLIENT: 'Cliente',
    DEALER: 'dealer',
});

const SYSTEM_ROLE_NAMES = Object.freeze(Object.values(SYSTEM_ROLES));

const PERMISSION_KEYS = Object.freeze(Object.values(PERMISSIONS));

const PERMISSION_LABELS = Object.freeze({
    [PERMISSIONS.ADMIN_ACCESS]: 'Acceso al panel administrativo',
    [PERMISSIONS.CATALOG_READ]: 'Consultar catálogo, productos, categorías y marcas',
    [PERMISSIONS.CATALOG_WRITE]: 'Crear, editar y eliminar productos, categorías y marcas',
    [PERMISSIONS.INVENTORY_READ]: 'Consultar existencias y alertas de inventario',
    [PERMISSIONS.ORDERS_READ]: 'Consultar pedidos',
    [PERMISSIONS.ORDERS_MANAGE]: 'Gestionar pedidos y cambios de estado',
    [PERMISSIONS.PAYMENTS_READ]: 'Consultar pagos y conciliaciones',
    [PERMISSIONS.PAYMENTS_MANAGE]: 'Confirmar pagos y resolver incidencias',
    [PERMISSIONS.STORE_SETTINGS_MANAGE]: 'Configurar tarifas y monto mínimo de envío',
    [PERMISSIONS.SALES_READ]: 'Consultar ventas y productos más vendidos',
    [PERMISSIONS.ANALYTICS_READ]: 'Consultar informes y analítica',
    [PERMISSIONS.REVIEWS_MODERATE]: 'Responder, ocultar y moderar reseñas',
    [PERMISSIONS.RAFFLE_MANAGE]: 'Administrar la rifa y seleccionar ganador',
    [PERMISSIONS.DELIVERY_MANAGE]: 'Asignar pedidos a repartidores y ver seguimiento',
    [PERMISSIONS.PROVIDERS_MANAGE]: 'Gestionar proveedores',
    [PERMISSIONS.USERS_MANAGE]: 'Gestionar usuarios',
    [PERMISSIONS.ROLES_MANAGE]: 'Gestionar roles y permisos',
    [PERMISSIONS.PROFILE_MANAGE]: 'Gestionar el perfil administrativo',
});

const ALL_PERMISSIONS = Object.freeze([...PERMISSION_KEYS]);
// El administrador operativo puede gestionar la tienda, pero no delegar
// permisos. Esa frontera queda reservada a SuperAdmin o a un rol al que el
// propio SuperAdmin haya concedido explícitamente roles:manage.
const ADMIN_PERMISSIONS = Object.freeze(
    ALL_PERMISSIONS.filter((permission) => permission !== PERMISSIONS.ROLES_MANAGE)
);

const PERMISSION_IMPLICATIONS = Object.freeze({
    [PERMISSIONS.CATALOG_WRITE]: [PERMISSIONS.CATALOG_READ],
    [PERMISSIONS.ORDERS_MANAGE]: [PERMISSIONS.ORDERS_READ],
    [PERMISSIONS.PAYMENTS_MANAGE]: [PERMISSIONS.PAYMENTS_READ],
});

function normalizePermissions(value) {
    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values.filter((permission) => PERMISSION_KEYS.includes(permission)))];
}

function expandPermissions(value) {
    const expanded = normalizePermissions(value);
    for (const permission of [...expanded]) {
        for (const implied of PERMISSION_IMPLICATIONS[permission] || []) {
            if (!expanded.includes(implied)) expanded.push(implied);
        }
    }
    return expanded;
}

module.exports = {
    PERMISSIONS,
    SYSTEM_ROLES,
    SYSTEM_ROLE_NAMES,
    PERMISSION_KEYS,
    PERMISSION_LABELS,
    ALL_PERMISSIONS,
    ADMIN_PERMISSIONS,
    PERMISSION_IMPLICATIONS,
    normalizePermissions,
    expandPermissions,
};
