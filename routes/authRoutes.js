const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { uploadRegistration } = require('../middleware/cloudinaryUpload');
const { registerValidation } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const tokenCacheControl = require('../middleware/tokenCacheControl');
const connectDB = require('../utils/db');

// Middleware to ensure DB connection
const ensureDBConnection = async (req, res, next) => {
  try {
    console.log('🔌 Ensuring DB connection for:', req.method, req.path);
    await connectDB();
    console.log('✅ DB connection verified');
    next();
  } catch (error) {
    console.error("❌ Database connection failed:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(503).json({
      success: false,
      message: "Database connection error",
      error: error.message,
      alert: "Service temporarily unavailable. Please try again."
    });
  }
};

// Registration (no rate limit) - Using Cloudinary upload
router.post('/register',
  ensureDBConnection,
  uploadRegistration,
  registerValidation,
  authController.register
);

// Login with rate limiting
router.post('/login', ensureDBConnection, loginLimiter, authController.login);

// Token verification (no rate limit)
router.get('/verify', tokenCacheControl, auth.verify, authController.verifyToken);

// Password reset (no rate limit)
router.post('/reset/request', authController.resetRequest);
router.post('/reset', authController.resetPassword);

// Email verification (no rate limit)
router.post('/verify/resend', authController.resendVerification);
router.get('/verify-email/:token', tokenCacheControl, authController.verifyEmail);

// Delete unverified
router.post('/delete-unverified', authController.deleteUnverified);

// Check email availability
router.post('/check-email', ensureDBConnection, authController.checkEmail);

module.exports = router;