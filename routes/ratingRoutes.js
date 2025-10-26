const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const auth = require('../middleware/auth');

// Ratings
router.post('/', auth.verify, ratingController.rateUser);
router.get('/top-rated', ratingController.getTopRated);
router.get('/given', auth.verify, ratingController.getGiven);
router.get('/:userId', ratingController.getRatings);
router.post('/:ratingId/report', auth.verify, ratingController.reportRating);

module.exports = router;