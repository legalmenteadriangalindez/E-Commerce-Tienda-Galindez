const mongoose = require('mongoose');
const { CommerceError, textField, validTransactionId } = require('./commerceShared');

const PAYMENT_STATUSES = new Set(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);

function transactionId(transaction) {
    const id = transaction?.id;
    if (!validTransactionId(id)) throw new CommerceError('Transacción no verificable.');
    return id;
}

function transactionStatus(status) {
    if (!PAYMENT_STATUSES.has(status)) throw new CommerceError('Estado de pago desconocido.');
    return status;
}

function objectId(id, message) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError(message);
    return id;
}

function reviewFields(note, receipt) {
    const motivo = textField(note, 'motivo de revisión', 500);
    if (motivo.length < 10) throw new CommerceError('Describe la revisión con al menos 10 caracteres.');
    return {
        motivo,
        comprobante: textField(receipt, 'comprobante o referencia', 150),
    };
}

module.exports = { transactionId, transactionStatus, objectId, reviewFields };
