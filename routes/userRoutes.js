const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { uploadProfilePicture } = require('../middleware/cloudinaryUpload');
const auth = require('../middleware/auth');

// User Profile
router.get('/me', auth.verify, userController.getProfile);

// Profile update with Cloudinary file upload support
router.put('/me', 
    auth.verify,
    uploadProfilePicture,
    userController.editProfile
);

// Change password
router.put('/me/password', auth.verify, userController.changePassword);

// Get workers (requires authentication)
router.get('/workers', auth.verify, userController.getWorkers);

// Search users (requires authentication) - for chat and messaging
router.get('/search', auth.verify, userController.searchUsers);

// Get support contact for help/support chat
router.get('/support-contact', auth.verify, userController.getSupportContact);

// Goals (Legacy)
router.post('/goals', auth.verify, userController.setGoal);

// Public: Get user by ID (always returns a user object, never 404)
const User = require('../models/User');
router.get('/:id', async (req, res) => {
    let user = null;
    try {
        user = await User.findById(req.params.id).select('-password');
    } catch (err) {
        // ignore error, will return default user
    }
    if (!user) {
        user = {
            _id: req.params.id,
            firstName: '',
            lastName: '',
            email: '',
            userType: '',
            isVerified: false,
            notificationPreferences: { job: false, message: false },
            languagePreference: '',
        };
    }
    res.status(200).json({
        success: true,
        user,
        alert: user.firstName ? "User retrieved successfully" : "Default user returned (not found)"
    });
});

module.exports = router;