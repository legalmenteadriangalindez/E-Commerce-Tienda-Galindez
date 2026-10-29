const test = require('node:test');
const assert = require('node:assert/strict');

const { runMaintenanceCycle } = require('../scripts/run-maintenance');

test('el mantenimiento ejecuta pagos, archivos y correos en orden', async () => {
    const calls = [];
    const result = await runMaintenanceCycle({
        commerce: {
            runMaintenance: async () => {
                calls.push('payments');
                return { pending: 2 };
            },
        },
        media: {
            cleanup: async () => {
                calls.push('media');
                return 1;
            },
        },
        emailNotifications: {
            processPending: async () => {
                calls.push('emails');
                return 3;
            },
        },
    });

    assert.deepEqual(calls, ['payments', 'media', 'emails']);
    assert.deepEqual(result, {
        payments: { pending: 2 },
        mediaCleanup: 1,
        emails: 3,
    });
});
