const EmailChange = require('../models/EmailChange');
const User = require('../models/User');
const Activity = require('../models/Activity');
const crypto = require('crypto');
const { sendEmailChangeVerification } = require('../utils/mailer');
const { createNotification } = require('../utils/notificationHelper');

// Helper function to create activity log
const createActivityLog = async (activityData) => {
  try {
    const activity = new Activity(activityData);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error creating activity log:', error);
    return null;
  }
};

// Request email change - sends verification to CURRENT email
exports.requestEmailChange = async (req, res) => {
  try {
    console.log('🔐 Email change request received');
    console.log('📋 Request body:', req.body);
    console.log('👤 User ID:', req.user.id);
    
    const { newEmail } = req.body;
    const userId = req.user.id;

    if (!newEmail) {
      return res.status(400).json({
        success: false,
        message: "New email is required",
        alert: "Please provide a new email address"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        alert: "Please provide a valid email address"
      });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "User account not found"
      });
    }

    // Check if new email is same as current
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Email is the same",
        alert: "New email must be different from current email"
      });
    }

    // Check if new email is already in use
    const existingUser = await User.findOne({ 
      email: newEmail.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
        alert: "This email is already registered to another account"
      });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Delete any existing email change requests for this user
    await EmailChange.deleteMany({ user: userId });

    // Create email change request
    const emailChange = await EmailChange.create({
      user: userId,
      currentEmail: user.email,
      newEmail: newEmail.toLowerCase(),
      token: token,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    });

    // Send verification email to CURRENT email
    const verificationLink = `/verify-email-change/${token}`;
    console.log('📧 Attempting to send email change verification to:', user.email);
    console.log('📧 New email:', newEmail);
    console.log('📧 Verification link:', verificationLink);
    
    try {
      await sendEmailChangeVerification(user.email, user.firstName, newEmail, verificationLink);
      console.log('✅ Email change verification sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send email change verification:', emailError);
      // Continue anyway - the request is saved in database
    }

    // Create notification
    await createNotification({
      recipient: userId,
      type: 'security_alert',
      message: `Email change requested. Check your current email (${user.email}) to verify.`
    });

    // Log activity
    await createActivityLog({
      userId: userId,
      userName: `${user.firstName} ${user.lastName}`,
      type: 'email_change_request',
      description: 'Email change requested',
      metadata: {
        currentEmail: user.email,
        newEmail: newEmail,
        requestedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: "Verification email sent to your current email address",
      alert: `Please check ${user.email} to verify this email change`
    });

  } catch (error) {
    console.error("Email change request error:", error);
    res.status(500).json({
      success: false,
      message: "Error requesting email change",
      error: error.message,
      alert: "Failed to request email change. Please try again."
    });
  }
};

// Verify email change with token
exports.verifyEmailChange = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
        alert: "Verification token is missing"
      });
    }

    // Find the email change request
    const emailChange = await EmailChange.findOne({ 
      token: token,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate('user', 'firstName lastName email');

    if (!emailChange) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
        alert: "This verification link is invalid or has expired"
      });
    }

    // Check if new email is still available
    const existingUser = await User.findOne({ 
      email: emailChange.newEmail,
      _id: { $ne: emailChange.user._id }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email no longer available",
        alert: "This email address is now taken by another account"
      });
    }

    // Update user's email
    const user = await User.findByIdAndUpdate(
      emailChange.user._id,
      { email: emailChange.newEmail },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "User account not found"
      });
    }

    // Mark token as used
    emailChange.used = true;
    await emailChange.save();

    // Create notification
    await createNotification({
      recipient: user._id,
      type: 'profile_update',
      message: `Your email has been successfully changed to ${user.email}`
    });

    // Log activity
    await createActivityLog({
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      type: 'email_changed',
      description: 'Email address successfully changed',
      metadata: {
        oldEmail: emailChange.currentEmail,
        newEmail: emailChange.newEmail,
        changedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: "Email changed successfully",
      alert: "Your email address has been updated",
      user: user
    });

  } catch (error) {
    console.error("Email change verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying email change",
      error: error.message,
      alert: "Failed to verify email change. Please try again."
    });
  }
};

// Cancel email change request
exports.cancelEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await EmailChange.deleteMany({ user: userId });

    res.status(200).json({
      success: true,
      message: "Email change request cancelled",
      alert: "Email change request has been cancelled",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Cancel email change error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling email change",
      error: error.message,
      alert: "Failed to cancel email change request"
    });
  }
};

// Get pending email change request for current user
exports.getPendingEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;

    const emailChange = await EmailChange.findOne({
      user: userId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!emailChange) {
      return res.status(200).json({
        success: false,
        hasPending: false,
        message: "No pending email change request"
      });
    }

    res.status(200).json({
      success: true,
      hasPending: true,
      emailChange: {
        currentEmail: emailChange.currentEmail,
        newEmail: emailChange.newEmail,
        expiresAt: emailChange.expiresAt,
        createdAt: emailChange.createdAt
      }
    });

  } catch (error) {
    console.error("Get pending email change error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching email change request",
      error: error.message,
      alert: "Failed to fetch email change request"
    });
  }
};
