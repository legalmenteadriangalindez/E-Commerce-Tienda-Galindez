const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const servicesRenderReviews = require('../../pages/renderReviews');

const router = express.Router();

router.get('/admin/reviews', requirePermission(P.REVIEWS_MODERATE), servicesRenderReviews.adminIndex);

module.exports = router;
