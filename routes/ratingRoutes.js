const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const auth = require('../middleware/auth');

// Middleware to disable caching for rating data (real-time updates)
const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};

// Ratings
router.post('/', auth.verify, ratingController.rateUser);
router.get('/top-rated', noCacheMiddleware, ratingController.getTopRated);
router.get('/given', auth.verify, noCacheMiddleware, ratingController.getGiven);
router.get('/:userId', noCacheMiddleware, ratingController.getRatings);
router.post('/:ratingId/report', auth.verify, ratingController.reportRating);

module.exports = router;