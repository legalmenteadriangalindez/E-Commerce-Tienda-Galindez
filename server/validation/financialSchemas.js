'use strict';

const { z } = require('zod');

// No se aceptan notación científica ni separadores ambiguos de miles.
const amount = z
    .string()
    .trim()
    .regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Usa pesos y hasta dos decimales, sin separadores de miles.')
    .refine((value) => Number(value) > 0, 'El importe debe ser mayor que cero.');

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const idempotency = z.string().uuid();
const paid = z.enum(['SI', 'NO']);
const categories = z.enum([
    'PUBLICIDAD',
    'TRANSPORTE',
    'EMPAQUES',
    'COMISIONES',
    'SERVICIOS',
    'ARRIENDO',
    'NOMINA',
    'OTROS',
]);
const expense = z.object({
    categoria: categories,
    descripcion: z.string().trim().min(3).max(250),
    monto: amount,
    fechaGasto: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
    pagado: paid,
    claveIdempotencia: idempotency,
});
const purchase = z.object({
    proveedor: objectId,
    producto: objectId,
    cantidad: z.coerce.number().int().min(1).max(1000000),
    costoUnitario: amount,
    referencia: z.string().trim().max(100).optional(),
    observacion: z.string().trim().max(250).optional(),
    pagado: paid,
    claveIdempotencia: idempotency,
});
const id = z.object({ id: objectId });
const period = z.object({ period: z.enum(['week', 'month']).optional() }).passthrough();

module.exports = { expense, purchase, id, period, categories };
