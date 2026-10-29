const express = require('express');
const { isLoggedApi } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrfProtection');
const reviewController = require('../controller/reviewController');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

const router = express.Router();
const parseTextFields = require('../middleware/reviewBody');

function verifiedAccount(req, res, next) {
    if (req.usuarioActual?.verified !== true) {
        return res.status(403).json({
            success: false,
            message: 'Verifica tu correo electrónico antes de publicar o editar una reseña.',
        });
    }
    return next();
}

router.get(
    '/',
    validate(
        schemas.pagination.extend({ producto: schemas.objectId.optional(), id: schemas.objectId.optional() }),
        'query'
    ),
    reviewController.find
);
router.post(
    '/',
    isLoggedApi,
    verifiedAccount,
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.review),
    reviewController.create
);
router.put(
    '/:id',
    isLoggedApi,
    verifiedAccount,
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.review),
    reviewController.update
);
router.delete(
    '/:id',
    isLoggedApi,
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    reviewController.delete
);

module.exports = router;
