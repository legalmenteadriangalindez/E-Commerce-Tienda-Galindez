const express = require('express');
const { isLoggedApi } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrfProtection');
const reviewController = require('../controller/reviewController');

const router = express.Router();
const parseTextFields = require('../middleware/reviewBody');

function verifiedAccount(req, res, next) {
    if (req.usuarioActual?.verified !== true) {
        return res.status(403).json({
            success: false,
            message: 'Verifica tu correo electrónico antes de publicar o editar una reseña.'
        });
    }
    return next();
}

router.get('/', reviewController.find);
router.post('/', isLoggedApi, verifiedAccount, parseTextFields,
    csrfProtection.validateToken, reviewController.create);
router.put('/:id', isLoggedApi, verifiedAccount, parseTextFields,
    csrfProtection.validateToken, reviewController.update);
router.delete('/:id', isLoggedApi, parseTextFields,
    csrfProtection.validateToken, reviewController.delete);

module.exports = router;
