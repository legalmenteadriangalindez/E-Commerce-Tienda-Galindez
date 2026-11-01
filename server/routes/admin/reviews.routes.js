const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const reviewsPageController = require('../../controller/pages/renderReviews');

const router = express.Router();

router.get('/admin/reviews', requirePermission(P.REVIEWS_MODERATE), reviewsPageController.adminIndex);

module.exports = router;
