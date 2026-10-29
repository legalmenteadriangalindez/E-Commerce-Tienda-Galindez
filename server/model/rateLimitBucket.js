const mongoose = require('mongoose');

const schema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        hits: {
            type: Number,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            expires: 0,
        },
    },
    {
        versionKey: false,
        collection: 'security_rate_limits',
    }
);

module.exports = mongoose.model('RateLimitBucket', schema);
