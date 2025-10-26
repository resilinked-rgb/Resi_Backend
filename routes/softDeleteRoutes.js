const express = require('express');
const router = express.Router();
const softDeleteController = require('../controllers/softDeleteController');
const auth = require('../middleware/auth');

// All routes require admin authentication
router.use(auth.verify);
router.use(auth.verifyAdmin);

// Soft-deleted users routes
router.get('/users', softDeleteController.getDeletedUsers);
router.post('/users/:id/restore', softDeleteController.restoreUser);
router.delete('/users/:id/permanent', softDeleteController.permanentlyDeleteUser);

// Soft-deleted jobs routes
router.get('/jobs', softDeleteController.getDeletedJobs);
router.post('/jobs/:id/restore', softDeleteController.restoreJob);
router.delete('/jobs/:id/permanent', softDeleteController.permanentlyDeleteJob);

// Soft-deleted goals routes
router.get('/goals', softDeleteController.getDeletedGoals);
router.post('/goals/:id/restore', softDeleteController.restoreGoal);
router.delete('/goals/:id/permanent', softDeleteController.permanentlyDeleteGoal);

module.exports = router;