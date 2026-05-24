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

router.get('/', reviewController.find);
router.put('/:id', reviewController.update);
router.delete('/:id', reviewController.delete);

module.exports = router;