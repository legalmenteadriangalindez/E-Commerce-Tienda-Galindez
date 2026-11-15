'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const reconciliation = require('../server/business/inventoryReconciliationService');

test('conciliación calcula reservas, ventas, liberaciones y devoluciones sin duplicar descuentos', () => {
    const movements = [
        { tipo: 'SALDO_INICIAL', cantidad: 10, deltaStock: 10, stockAntes: 0 },
        { tipo: 'RESERVA', cantidad: 2, deltaStock: -2, stockAntes: 10 },
        { tipo: 'VENTA', cantidad: 2, deltaStock: 0, stockAntes: 8 },
        { tipo: 'LIBERACION', cantidad: 1, deltaStock: 1, stockAntes: 8 },
        { tipo: 'DEVOLUCION', cantidad: 1, deltaStock: 1, stockAntes: 9 },
    ];

    const result = reconciliation.calculateFromMovements(movements);
    assert.equal(result.stockCalculado, 10);
    assert.equal(result.saldoInicial, 10);
    assert.equal(result.reservas, 2);
    assert.equal(result.liberaciones, 1);
    assert.equal(result.devoluciones, 1);
    assert.equal(result.ventas, 1);
    assert.equal(result.ambiguousCount, 0);
});

test('conciliación conserva entradas históricas y marca ajustes sin delta como ambiguos', () => {
    const movements = [
        {
            tipo: 'ENTRADA',
            cantidad: 8,
            deltaStock: 8,
            stockAntes: 0,
            motivo: 'Stock inicial del producto',
        },
        { tipo: 'AJUSTE', cantidad: 2, stockAntes: 8, motivo: 'Conteo físico antiguo' },
        { tipo: 'DANO', cantidad: 1, deltaStock: -1, stockAntes: 8 },
    ];

    const result = reconciliation.calculateFromMovements(movements);
    assert.equal(result.stockCalculado, 7);
    assert.equal(result.saldoInicial, 8);
    assert.equal(result.entradas, 0);
    assert.equal(result.ajustes, -1);
    assert.equal(result.ambiguousCount, 1);
    assert.equal(reconciliation.isLegacyOpeningMovement(movements[0]), true);
});

test('conciliación explica diferencias sin corregirlas', () => {
    assert.match(
        reconciliation.possibleCause({
            stockAlmacenado: 12,
            stockCalculado: 10,
            movimientoCount: 3,
            ambiguousCount: 0,
        }),
        /stock almacenado es mayor/i
    );
    assert.match(
        reconciliation.possibleCause({
            stockAlmacenado: 8,
            stockCalculado: 10,
            movimientoCount: 3,
            ambiguousCount: 0,
        }),
        /historial supera al stock/i
    );
    assert.match(
        reconciliation.possibleCause({ stockAlmacenado: 0, stockCalculado: 0, movimientoCount: 0, ambiguousCount: 0 }),
        /sin movimientos/i
    );
});
