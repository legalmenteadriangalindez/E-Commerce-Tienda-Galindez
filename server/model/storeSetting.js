'use strict';

const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

const schema = new mongoose.Schema(
    {
        clave: { type: String, required: true, trim: true, maxlength: 80 },
        shippingPriceCents: integerCentsPath({ default: 500000 }),
        freeShippingFromCents: integerCentsPath({ default: 3000000 }),
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' },
    },
    { timestamps: true }
);

schema.index({ clave: 1 }, { unique: true });

module.exports = mongoose.model('storesettingdb', schema);
