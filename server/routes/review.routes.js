const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const reviewController = require('../controller/reviewController');

router.post('/',
    upload.fields([
        { name: 'fotos', maxCount: 5 },
        { name: 'video', maxCount: 1 }
    ]),
    reviewController.create
);

router.get('/',isLogged, reviewController.find);
router.put('/:id',isLogged, reviewController.update);
router.delete('/:id',isLogged, reviewController.delete);

module.exports = router;
