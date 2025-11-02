const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const auth = require('../middleware/auth');
const { uploadPaymentProof } = require('../middleware/cloudinaryUpload');

// Middleware to disable caching for job data (real-time updates)
const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};

// Jobs
router.post('/', auth.verify, jobController.postJob);
router.get('/', noCacheMiddleware, jobController.getAll);
router.get('/my-matches', auth.verify, noCacheMiddleware, jobController.getMyMatches);
router.get('/my-jobs', auth.verify, noCacheMiddleware, jobController.getMyJobs);
router.get('/my-applications', auth.verify, noCacheMiddleware, jobController.getMyApplications);
router.get('/my-applications-received', auth.verify, noCacheMiddleware, jobController.getMyApplicationsReceived);
router.get('/my-invitations', auth.verify, noCacheMiddleware, jobController.getMyInvitations);
router.get('/search', noCacheMiddleware, jobController.search);
router.get('/popular', noCacheMiddleware, jobController.getPopularJobs);
router.get('/employer/:employerId/completed', auth.verify, noCacheMiddleware, jobController.getEmployerCompletedJobs);
// Specific routes with parameters must come after static routes
router.post('/:id/apply', auth.verify, jobController.applyJob);
router.delete('/:id/cancel-application', auth.verify, jobController.cancelApplication);
router.post('/:id/assign', auth.verify, jobController.assignWorker);
router.post('/:id/reject', auth.verify, jobController.rejectApplication);
router.post('/:id/invite', auth.verify, jobController.inviteWorker);
router.post('/:id/accept-invitation', auth.verify, jobController.acceptInvitation);
router.post('/:id/decline-invitation', auth.verify, jobController.declineInvitation);
router.put('/:jobId/applicants/:userId', auth.verify, jobController.updateApplicantStatus);
router.put('/:id/close', auth.verify, jobController.closeJob);
router.put('/:id/complete', auth.verify, uploadPaymentProof, jobController.completeJob);
router.put('/:id', auth.verify, jobController.editJob);
router.delete('/:id', auth.verify, jobController.deleteJob);
// Generic /:id route MUST be last to avoid catching specific routes
router.get('/:id', noCacheMiddleware, jobController.getJob);  // Individual job details

module.exports = router;
