'use strict';

const { z } = require('zod');

const objectId = z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i, 'Debe ser un identificador válido.');
const text = (max = 200) => z.string().trim().max(max);
const optionalText = (max = 200) => text(max).optional();

const passthrough = (shape) => z.object(shape).passthrough();

const pagination = passthrough({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

const idParams = passthrough({ id: objectId });
const optionalIdQuery = pagination.extend({ id: objectId.optional() });

const login = passthrough({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
});

const register = passthrough({
    nombre: text(200).min(1),
    telefono: text(40).min(1),
    direccion: text(200).min(1),
    genero: text(80).min(1),
    barrio: text(120).min(1),
    ciudad: text(120).min(1),
    puntoReferencia: optionalText(200),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(72),
});

const verification = passthrough({
    email: z.string().trim().email().max(254),
    code: z
        .string()
        .regex(/^\d{6}$/, 'El código debe tener seis dígitos.')
        .optional(),
});
const forgotPassword = passthrough({ email: z.string().trim().email().max(254) });
const resetPassword = passthrough({
    token: z.string().regex(/^[a-f\d]{64}$/i),
    password: z.string().min(12).max(72),
});

const category = passthrough({ nombre: text(100).min(1) });
const provider = passthrough({
    nombre: optionalText(160),
    telefono: optionalText(40),
    direccion: optionalText(200),
    descripcion: optionalText(500),
});
const brand = passthrough({ nombre: text(100).min(1) });
const role = passthrough({
    nombre: text(80).min(1),
    descripcion: optionalText(500),
    permisos: z.union([z.array(z.string().max(100)), z.string().max(2000)]).optional(),
});
const product = passthrough({
    nombre: optionalText(200),
    descripcion: optionalText(5000),
    precioVenta: z.union([z.string(), z.number()]).optional(),
    precioCosto: z.union([z.string(), z.number()]).optional(),
    stock: z.coerce.number().int().min(0).max(100000000).optional(),
    categoria: z.union([objectId, z.literal('')]).optional(),
    marca: z.union([objectId, z.literal('')]).optional(),
    proveedor: z.union([objectId, z.literal('')]).optional(),
    eliminarFotos: z.union([z.array(z.string().max(500)), z.string().max(500)]).optional(),
    _csrf: optionalText(200),
});
const user = passthrough({
    nombre: optionalText(200),
    email: z.string().trim().email().max(254).optional(),
    password: z.string().max(72).optional(),
    telefono: optionalText(40),
    direccion: optionalText(200),
    genero: optionalText(80),
    barrio: optionalText(120),
    ciudad: optionalText(120),
    puntoReferencia: optionalText(200),
    ubicacion: z.record(z.string(), z.number()).optional(),
    estado: z.enum(['Activo', 'Inactivo']).optional(),
    rol: objectId.optional(),
});
const orderUpdate = passthrough({ estado: z.string().trim().min(1).max(40) });
const review = passthrough({
    producto: objectId.optional(),
    calificacion: z.coerce.number().int().min(1).max(5).optional(),
    comentario: text(1000).optional(),
});
const adminReview = passthrough({
    texto: optionalText(1000),
    motivo: optionalText(500),
    oculta: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    version: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    _csrf: optionalText(200),
    returnTo: optionalText(500),
});
const cartAdd = passthrough({
    productoId: objectId,
    cantidad: z.coerce.number().int().min(1).max(999),
});
const cartRemove = passthrough({ productoId: objectId });
const paymentPoint = passthrough({
    productos: z
        .array(
            passthrough({
                productoId: objectId,
                cantidad: z.coerce.number().int().min(1).max(999),
            })
        )
        .min(1)
        .max(100),
});
const cartCheckout = passthrough({
    claveCheckout: z.string().uuid().optional(),
    totalCotizado: z.union([z.string(), z.number()]).optional(),
    email: z.string().trim().email().max(254).optional(),
    fullName: optionalText(120),
    phone: optionalText(40),
    address: optionalText(200),
    city: optionalText(100),
    department: optionalText(100),
    reference: optionalText(200),
    notes: optionalText(1000),
});
const salesQuery = pagination.extend({
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    estadoPago: z.string().trim().max(40).optional(),
    canal: z.string().trim().max(40).optional(),
});
const searchQuery = pagination.extend({ search: z.string().trim().max(100).optional() });

module.exports = {
    objectId,
    pagination,
    idParams,
    optionalIdQuery,
    login,
    register,
    verification,
    forgotPassword,
    resetPassword,
    category,
    provider,
    brand,
    role,
    product,
    user,
    orderUpdate,
    review,
    adminReview,
    cartAdd,
    cartRemove,
    paymentPoint,
    cartCheckout,
    salesQuery,
    searchQuery,
};
