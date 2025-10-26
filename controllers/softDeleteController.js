/**
 * Admin controller functions for soft delete management
 * Allows admins to view, restore, and permanently delete soft-deleted records
 */

const User = require('../models/User');
const Job = require('../models/Job');
const Goal = require('../models/Goal');
const { createNotification } = require('../utils/notificationHelper');
const Activity = require('../models/Activity');

// Create activity log helper
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

// Get all soft-deleted users
exports.getDeletedUsers = async (req, res) => {
  try {
    // We need to bypass the global query middleware
    const deletedUsers = await User.find({ isDeleted: true });
    
    res.status(200).json({
      success: true,
      count: deletedUsers.length,
      users: deletedUsers.map(user => ({
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userType: user.userType,
        deletedAt: user.deletedAt
      })),
      alert: `Found ${deletedUsers.length} deleted users`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching deleted users",
      error: err.message,
      alert: "Failed to retrieve deleted users"
    });
  }
};

// Restore a soft-deleted user
exports.restoreUser = async (req, res) => {
  try {
    // Find the user with isDeleted flag, bypassing the middleware
    const user = await User.findOne({ 
      _id: req.params.id,
      isDeleted: true 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Deleted user not found",
        alert: "This user doesn't exist or was never deleted"
      });
    }
    
    // Restore the user by setting isDeleted to false
    user.isDeleted = false;
    user.deletedAt = null;
    await user.save();
    
    // Log the action
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'user_restore',
      description: `Admin restored deleted user: ${user.email}`,
      metadata: {
        restoredUserId: user._id,
        restoredUserEmail: user.email,
        restoredUserName: `${user.firstName} ${user.lastName}`
      }
    });
    
    // Send notification to both admin and restored user
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You restored user account: ${user.email}`
    });
    
    await createNotification({
      recipient: user._id,
      type: 'account_update',
      message: `Your account has been restored by an administrator`
    });
    
    res.status(200).json({
      success: true,
      message: "User restored successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userType: user.userType
      },
      alert: "User account has been restored"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error restoring user",
      error: err.message,
      alert: "Failed to restore user account"
    });
  }
};

// Permanently delete a user (admin only - destructive action)
exports.permanentlyDeleteUser = async (req, res) => {
  try {
    // Find the user to get details before permanent deletion
    const user = await User.findOne({ _id: req.params.id, isDeleted: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Deleted user not found",
        alert: "This user doesn't exist or was never deleted"
      });
    }
    
    const userDetails = {
      id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    };
    
    // Permanently delete the user
    await User.deleteOne({ _id: req.params.id });
    
    // Log the permanent deletion
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'user_permanent_delete',
      description: `Admin permanently deleted user: ${userDetails.email}`,
      metadata: {
        deletedUserId: userDetails.id,
        deletedUserEmail: userDetails.email,
        deletedUserName: userDetails.name
      }
    });
    
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You permanently deleted user account: ${userDetails.email}`
    });
    
    res.status(200).json({
      success: true,
      message: "User permanently deleted",
      deletedUser: userDetails,
      alert: "User account has been permanently deleted"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error permanently deleting user",
      error: err.message,
      alert: "Failed to permanently delete user account"
    });
  }
};

// Get all soft-deleted jobs
exports.getDeletedJobs = async (req, res) => {
  try {
    // We need to bypass the global query middleware
    const deletedJobs = await Job.find({ isDeleted: true })
      .populate('postedBy', 'firstName lastName email');
    
    res.status(200).json({
      success: true,
      count: deletedJobs.length,
      jobs: deletedJobs.map(job => ({
        id: job._id,
        title: job.title,
        postedBy: job.postedBy ? `${job.postedBy.firstName} ${job.postedBy.lastName}` : 'Unknown',
        price: job.price,
        datePosted: job.datePosted,
        deletedAt: job.deletedAt
      })),
      alert: `Found ${deletedJobs.length} deleted jobs`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching deleted jobs",
      error: err.message,
      alert: "Failed to retrieve deleted jobs"
    });
  }
};

// Restore a soft-deleted job
exports.restoreJob = async (req, res) => {
  try {
    // Find the job with isDeleted flag, bypassing the middleware
    const job = await Job.findOne({ 
      _id: req.params.id,
      isDeleted: true 
    }).populate('postedBy', 'firstName lastName email');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Deleted job not found",
        alert: "This job doesn't exist or was never deleted"
      });
    }
    
    // Restore the job by setting isDeleted to false
    job.isDeleted = false;
    job.deletedAt = null;
    await job.save();
    
    // Log the action
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'job_restore',
      description: `Admin restored deleted job: ${job.title}`,
      metadata: {
        restoredJobId: job._id,
        restoredJobTitle: job.title,
        postedBy: job.postedBy ? job.postedBy._id : null
      }
    });
    
    // Send notification to both admin and job poster
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You restored job: ${job.title}`
    });
    
    if (job.postedBy) {
      await createNotification({
        recipient: job.postedBy._id,
        type: 'job_update',
        message: `Your job "${job.title}" has been restored by an administrator`,
        relatedJob: job._id
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Job restored successfully",
      job: {
        id: job._id,
        title: job.title,
        postedBy: job.postedBy ? `${job.postedBy.firstName} ${job.postedBy.lastName}` : 'Unknown'
      },
      alert: "Job has been restored"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error restoring job",
      error: err.message,
      alert: "Failed to restore job"
    });
  }
};

// Permanently delete a job (admin only - destructive action)
exports.permanentlyDeleteJob = async (req, res) => {
  try {
    // Find the job to get details before permanent deletion
    const job = await Job.findOne({ _id: req.params.id, isDeleted: true });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Deleted job not found",
        alert: "This job doesn't exist or was never deleted"
      });
    }
    
    const jobDetails = {
      id: job._id,
      title: job.title,
      postedBy: job.postedBy
    };
    
    // Permanently delete the job
    await Job.deleteOne({ _id: req.params.id });
    
    // Log the permanent deletion
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'job_permanent_delete',
      description: `Admin permanently deleted job: ${jobDetails.title}`,
      metadata: {
        deletedJobId: jobDetails.id,
        deletedJobTitle: jobDetails.title,
        postedBy: jobDetails.postedBy
      }
    });
    
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You permanently deleted job: ${jobDetails.title}`
    });
    
    res.status(200).json({
      success: true,
      message: "Job permanently deleted",
      deletedJob: jobDetails,
      alert: "Job has been permanently deleted"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error permanently deleting job",
      error: err.message,
      alert: "Failed to permanently delete job"
    });
  }
};

// Get all soft-deleted goals
exports.getDeletedGoals = async (req, res) => {
  try {
    // We need to bypass the global query middleware
    const deletedGoals = await Goal.find({ isDeleted: true })
      .populate('user', 'firstName lastName email');
    
    res.status(200).json({
      success: true,
      count: deletedGoals.length,
      goals: deletedGoals.map(goal => ({
        id: goal._id,
        description: goal.description,
        targetAmount: goal.targetAmount,
        progress: goal.progress,
        completed: goal.completed,
        user: goal.user ? `${goal.user.firstName} ${goal.user.lastName}` : 'Unknown',
        deletedAt: goal.deletedAt
      })),
      alert: `Found ${deletedGoals.length} deleted goals`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching deleted goals",
      error: err.message,
      alert: "Failed to retrieve deleted goals"
    });
  }
};

// Restore a soft-deleted goal
exports.restoreGoal = async (req, res) => {
  try {
    // Find the goal with isDeleted flag, bypassing the middleware
    const goal = await Goal.findOne({ 
      _id: req.params.id,
      isDeleted: true 
    }).populate('user', 'firstName lastName email');
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Deleted goal not found",
        alert: "This goal doesn't exist or was never deleted"
      });
    }
    
    // Restore the goal by setting isDeleted to false
    goal.isDeleted = false;
    goal.deletedAt = null;
    // Do not automatically re-activate the goal
    await goal.save();
    
    // Log the action
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'goal_restore',
      description: `Admin restored deleted goal: ${goal.description}`,
      metadata: {
        restoredGoalId: goal._id,
        restoredGoalDescription: goal.description,
        goalOwner: goal.user ? goal.user._id : null
      }
    });
    
    // Send notification to both admin and goal owner
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You restored goal: ${goal.description}`
    });
    
    if (goal.user) {
      await createNotification({
        recipient: goal.user._id,
        type: 'goal_update',
        message: `Your goal "${goal.description}" has been restored by an administrator`
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Goal restored successfully",
      goal: {
        id: goal._id,
        description: goal.description,
        user: goal.user ? `${goal.user.firstName} ${goal.user.lastName}` : 'Unknown'
      },
      alert: "Goal has been restored"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error restoring goal",
      error: err.message,
      alert: "Failed to restore goal"
    });
  }
};

// Permanently delete a goal (admin only - destructive action)
exports.permanentlyDeleteGoal = async (req, res) => {
  try {
    // Find the goal to get details before permanent deletion
    const goal = await Goal.findOne({ _id: req.params.id, isDeleted: true });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Deleted goal not found",
        alert: "This goal doesn't exist or was never deleted"
      });
    }
    
    const goalDetails = {
      id: goal._id,
      description: goal.description,
      user: goal.user
    };
    
    // Permanently delete the goal
    await Goal.deleteOne({ _id: req.params.id });
    
    // Log the permanent deletion
    await createActivityLog({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      type: 'goal_permanent_delete',
      description: `Admin permanently deleted goal: ${goalDetails.description}`,
      metadata: {
        deletedGoalId: goalDetails.id,
        deletedGoalDescription: goalDetails.description,
        goalOwner: goalDetails.user
      }
    });
    
    await createNotification({
      recipient: req.user.id,
      type: 'admin_message',
      message: `You permanently deleted goal: ${goalDetails.description}`
    });
    
    res.status(200).json({
      success: true,
      message: "Goal permanently deleted",
      deletedGoal: goalDetails,
      alert: "Goal has been permanently deleted"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error permanently deleting goal",
      error: err.message,
      alert: "Failed to permanently delete goal"
    });
  }
};