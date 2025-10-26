const User = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');
const Activity = require('../models/Activity');
const bcrypt = require('bcryptjs');

// ✅ Helper function to create activity log
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

// ✅ GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('goals');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "Your profile could not be found",
      });
    }

    res.status(200).json({
      success: true,
      user,
      alert: "Profile loaded successfully",
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: err.message,
      alert: "Failed to load profile",
    });
  }
};

// ✅ EDIT PROFILE (Full Version)
exports.editProfile = async (req, res) => {
  try {
    const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
    let updates = {};

    // Handle multipart (image upload)
    if (isMultipart && req.file) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Processing file upload');
        console.log('File details:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });
      }

      // Store file path instead of base64
      if (req.file.path) {
        // Disk storage - extract relative path from uploads directory
        const relativePath = req.file.path.replace(/\\/g, '/').split('/uploads/')[1];
        updates.profilePicture = relativePath ? `uploads/${relativePath}` : req.file.path.replace(/\\/g, '/');
      } else if (req.file.buffer) {
        // Memory storage (e.g., Render) - fallback to base64 with data URI
        updates.profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (req.body[key] && req.body[key] !== '') {
            updates[key] = req.body[key];
          }
        });
      }
    } else {
      updates = { ...req.body };
      if (process.env.NODE_ENV === 'development') {
        console.log('Regular JSON updates:', updates);
      }
    }

    console.log('Final updates to apply:', updates);

    if (!updates.firstName || !updates.lastName || !updates.email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        alert: "First name, last name, and email are required",
      });
    }

    const originalUser = await User.findById(req.user.id);
    if (!originalUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "Your profile could not be found",
      });
    }

    // ✅ Handle skills string -> array conversion
    if (updates.skills) {
      if (typeof updates.skills === 'string') {
        try {
          updates.skills = updates.skills
            .split(',')
            .map(skill => skill.trim())
            .filter(skill => skill);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error processing skills:', error);
          }
          delete updates.skills;
        }
      } else if (Array.isArray(updates.skills)) {
        updates.skills = updates.skills.filter(skill => skill && skill.trim() !== '');
      }
    }

    // ✅ Email uniqueness check - prevent direct email changes
    if (updates.email && updates.email !== originalUser.email) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be changed directly",
        alert: "To change your email, please use the 'Change Email' feature which requires verification",
        requiresVerification: true
      });
    }

    // ✅ Perform the update
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "Your profile could not be found",
      });
    }

    // ✅ Track changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (originalUser[key] !== user[key]) {
        changes[key] = {
          from: originalUser[key],
          to: user[key],
        };
      }
    });

    // ✅ Create notification + activity log if changes exist
    if (Object.keys(changes).length > 0) {
      try {
        await createNotification({
          recipient: user._id,
          type: 'profile_update',
          message: 'Your profile was updated',
        });

        await createActivityLog({
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          type: 'profile_update',
          description: 'User updated their profile',
          metadata: {
            updatedFields: Object.keys(changes),
            updateTime: new Date(),
          },
        });
      } catch (logError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating notification/activity log:', logError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
      alert: "Profile updated successfully",
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Profile update error:', err);
    }

    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: err.message,
      alert: "Failed to update profile",
    });
  }
};

// ✅ SET GOAL
exports.setGoal = async (req, res) => {
  try {
    const { targetAmount, description } = req.body;

    if (!targetAmount || !description) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["targetAmount", "description"],
        alert: "Please fill all required fields",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        alert: "Your profile could not be found",
      });
    }

    user.goals.push({
      targetAmount,
      description,
      progress: 0,
      createdAt: new Date(),
    });
    await user.save();

    await createNotification({
      recipient: user._id,
      type: 'goal_created',
      message: `New goal set: ${description} (₱${targetAmount})`,
    });

    await createActivityLog({
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      type: 'goal_created',
      description: `User created a new goal: ${description}`,
      metadata: {
        targetAmount,
        description,
      },
    });

    res.status(200).json({
      message: "Goal set successfully",
      goals: user.goals,
      alert: "New goal added to your profile",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error setting goal",
      error: err.message,
      alert: "Failed to set goal",
    });
  }
};

// ✅ GET WORKERS
exports.getWorkers = async (req, res) => {
  try {
    const { barangay, skill, search, keyword, page = 1, limit = 20 } = req.query;

    // Support both 'search' and 'keyword' parameters
    const searchTerm = keyword || search;

    let query = {
      userType: { $in: ['employee', 'both'] },
      isVerified: true,
    };

    if (barangay) query.barangay = barangay;
    if (skill) query.skills = { $in: skill.split(',') };
    if (searchTerm) {
      query.$or = [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { skills: { $in: [new RegExp(searchTerm, 'i')] } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -idNumber -idFrontImage -idBackImage')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'search',
      description: 'User searched for workers',
      metadata: {
        searchParams: {
          barangay: barangay || 'all',
          skill: skill || 'all',
          search: searchTerm || '',
          page,
          limit,
          results: total,
        },
      },
    });

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      alert: users.length
        ? `Found ${total} workers`
        : "No workers found matching your criteria",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching workers",
      error: err.message,
      alert: "Failed to load workers",
    });
  }
};

// ✅ SEARCH USERS (for chat/messaging)
exports.searchUsers = async (req, res) => {
  try {
    const { search, userType, limit = 20 } = req.query;

    const query = {
      isVerified: true,
    };

    // Add userType filter if provided
    if (userType) {
      query.userType = userType;
    }

    // Add search filter if provided
    if (search && search.trim().length > 0) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('firstName lastName email userType profilePicture')
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      users,
      alert: users.length ? `Found ${users.length} users` : "No users found",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error searching users",
      error: err.message,
      alert: "Failed to search users",
    });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide both current and new password",
        alert: "Both passwords are required"
      });
    }

    // Find user with password field
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        alert: "User not found"
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
        alert: "Current password is incorrect"
      });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      alert: "Password changed successfully"
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: err.message,
      alert: "Failed to change password"
    });
  }
};

// Get Support Contact (Admin user for support chat)
exports.getSupportContact = async (req, res) => {
  try {
    const Admin = require('../models/Admin');
    const User = require('../models/User');
    
    // First try to find an admin from Admin model
    let admin = await Admin.findOne()
      .select('username email')
      .sort({ createdAt: 1 }); // Get the first created admin

    // If no Admin model admin exists, try to find a user with userType 'admin'
    if (!admin) {
      const adminUser = await User.findOne({ userType: 'admin' })
        .select('firstName lastName email profilePicture')
        .sort({ createdAt: 1 });

      if (adminUser) {
        // Return admin user info formatted for chat
        return res.status(200).json({
          success: true,
          supportContact: {
            _id: adminUser._id,
            firstName: adminUser.firstName || 'ResiLinked',
            lastName: adminUser.lastName || 'Support',
            email: adminUser.email,
            userType: 'admin',
            profilePicture: adminUser.profilePicture || null
          },
          alert: "Support contact loaded"
        });
      }

      // No admin found in either model
      return res.status(404).json({
        success: false,
        message: "No support contact available",
        alert: "Support contact not found"
      });
    }

    // Return Admin model admin info formatted like a user for chat
    res.status(200).json({
      success: true,
      supportContact: {
        _id: admin._id,
        firstName: 'ResiLinked',
        lastName: 'Support',
        email: admin.email,
        userType: 'admin',
        profilePicture: null
      },
      alert: "Support contact loaded"
    });
  } catch (err) {
    console.error('Get support contact error:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching support contact",
      error: err.message,
      alert: "Failed to load support contact"
    });
  }
};

