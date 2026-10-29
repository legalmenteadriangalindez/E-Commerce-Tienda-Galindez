const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { validateEnvironment } = require('../server/config/production');
const errors = validateEnvironment({ ...process.env, NODE_ENV: 'production' });
if (process.env.PAYMENTS_ENABLED !== 'true')
    errors.push('Los pagos están deshabilitados. Actívalos solo después de probar Wompi sandbox.');
if (process.env.WOMPI_ENV !== 'production')
    errors.push('El cobro real requiere WOMPI_ENV=production y sus claves correspondientes.');
if (!errors.length) {
    console.log('Configuración de producción válida. No se muestran secretos.');
    console.log(
        'Pendiente comprobar en servicios reales: correo, webhook, copias/restauración, políticas y compra controlada.'
    );
} else {
    errors.forEach((error) => console.error('- ' + error));
    process.exitCode = 1;
}
