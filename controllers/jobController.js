const mongoose = require('mongoose');
const Job = require('../models/Job');
const User = require('../models/User');
const { findMatchingJobs } = require('../utils/matchingEngine');
const { createNotification } = require('../utils/notificationHelper');
const { sendSMS } = require('../utils/smsService');
const { addIncomeToActiveGoal } = require('./goalController');

//  POST /api/jobs → Post a new job
exports.postJob = async (req, res) => {
    try {
        if (!req.body.title || !req.body.price || !req.body.barangay) {
            return res.status(400).json({
                message: "Missing required fields",
                required: ["title", "price", "barangay"],
                alert: "Please fill all required fields"
            });
        }

        const job = new Job({ 
            ...req.body, 
            postedBy: req.user.id,
            status: 'open'
        });

        await job.save();

        const matchingUsers = await User.find({
            barangay: job.barangay,
            skills: { $in: job.skillsRequired },
            userType: { $in: ['employee', 'both'] }
        });

        matchingUsers.forEach(async user => {
            await createNotification({
                recipient: user._id,
                type: 'job_match',
                message: `New job in your area matching your skills: ${job.title}`,
                relatedJob: job._id
            });

            if (user.notificationPreferences?.sms) {
                await sendSMS(
                    user._id,
                    `New job in ${job.barangay}: ${job.title}. Pay: ₱${job.price}`
                );
            }
        });

        res.status(201).json({
            message: "Job posted successfully",
            job,
            matchesFound: matchingUsers.length,
            alert: "Job posted! Potential candidates will be notified"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error posting job", 
            error: err.message,
            alert: "Failed to post job. Please try again."
        });
    }
};

//  GET /api/jobs → Get all open jobs
exports.getAll = async (req, res) => {
    try {
        console.log('getAll jobs - Query params:', req.query);
        
        const { 
            sortBy = 'datePosted', 
            order = 'desc',
            limit,
            startDate,
            endDate,
            status,
            postedBy,
            completed
        } = req.query;

        console.log('Parsed params - sortBy:', sortBy, 'order:', order, 'limit:', limit);

        // Build query - allow filtering by various criteria
        let query = {};
        
        // Filter by postedBy if provided (for viewing employer's jobs)
        if (postedBy) {
            query.postedBy = postedBy;
        } else {
            // Only show open, non-completed jobs if not filtering by specific employer
            query.isOpen = true;
            query.completed = false;
        }
        
        // Filter by completed status if explicitly provided (override default)
        if (completed !== undefined) {
            query.completed = completed === 'true';
        }
        
        // Add date filtering if provided
        if (startDate || endDate) {
            query.datePosted = {};
            if (startDate) query.datePosted.$gte = new Date(startDate);
            if (endDate) query.datePosted.$lte = new Date(endDate);
        }

        // Add status filtering if provided
        if (status && status !== 'all') {
            query.status = status;
        }

        console.log('Final query:', query);

        // Build sort object
        const sortObj = {};
        const sortOrder = order === 'asc' ? 1 : -1;
        
        // Handle different sort fields
        switch (sortBy) {
            case 'datePosted':
                sortObj.datePosted = sortOrder;
                break;
            case 'price':
                sortObj.price = sortOrder;
                break;
            case 'applicants':
                // For applicants count, we'll need to use aggregation
                const pipeline = [
                    { $match: query },
                    {
                        $addFields: {
                            applicantCount: { $size: "$applicants" }
                        }
                    },
                    { $sort: { applicantCount: sortOrder } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'postedBy',
                            foreignField: '_id',
                            as: 'postedBy',
                            pipeline: [{ $project: { firstName: 1, lastName: 1, profilePicture: 1 } }]
                        }
                    },
                    { $unwind: '$postedBy' }
                ];
                
                if (limit) pipeline.push({ $limit: parseInt(limit) });
                
                const aggregatedJobs = await Job.aggregate(pipeline);
                return res.status(200).json({
                    jobs: aggregatedJobs,
                    alert: `Found ${aggregatedJobs.length} open jobs`
                });
                
            default:
                sortObj.datePosted = -1; // Default to newest first
        }

        let jobQuery = Job.find(query)
            .populate('postedBy', 'firstName lastName profilePicture')
            .populate('assignedTo', 'firstName lastName profilePicture email')
            .sort(sortObj);

        if (limit) {
            jobQuery = jobQuery.limit(parseInt(limit));
        }

        const jobs = await jobQuery;

        // If fetching completed jobs, also fetch ratings for each job
        if (completed === 'true') {
            const Rating = require('../models/Rating');
            
            const jobsWithRatings = await Promise.all(jobs.map(async (job) => {
                const jobObj = job.toObject();
                
                // Find rating for this job
                const rating = await Rating.findOne({ job: job._id })
                    .populate('rater', 'firstName lastName')
                    .lean();
                
                if (rating) {
                    jobObj.rating = rating.rating;
                    jobObj.ratingComment = rating.comment;
                    jobObj.ratedBy = rating.rater;
                    jobObj.ratedAt = rating.createdAt;
                }
                
                return jobObj;
            }));
            
            return res.status(200).json({
                jobs: jobsWithRatings,
                alert: `Found ${jobsWithRatings.length} completed jobs`
            });
        }

        res.status(200).json({
            jobs,
            alert: `Found ${jobs.length} ${completed === 'true' ? 'completed' : status ? status : 'open'} jobs`
        });
    } catch (err) {
        console.error('Error in getAll jobs:', err);
        res.status(500).json({ 
            message: "Error fetching jobs", 
            error: err.message,
            alert: "Failed to load jobs"
        });
    }
};

//  GET /api/jobs/:id → Get a specific job by ID
exports.getJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'firstName lastName profilePicture email')
            .populate('applicants.user', 'firstName lastName profilePicture email')
            .populate('assignedTo', 'firstName lastName profilePicture email');

        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "The requested job does not exist"
            });
        }

        res.status(200).json(job);
    } catch (err) {
        res.status(500).json({ 
            message: "Error fetching job", 
            error: err.message,
            alert: "Failed to load job details"
        });
    }
};

// GET /api/jobs/my-matches → Get jobs matching logged-in user
exports.getMyMatches = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                alert: "Your account information could not be found"
            });
        }
        
        if (!user.skills || user.skills.length === 0) {
            return res.status(200).json({
                jobs: [],
                alert: "Update your profile with skills to see job matches",
                noSkills: true
            });
        }
        
        const matchingJobs = await findMatchingJobs(user);

        res.status(200).json({
            jobs: matchingJobs,
            alert: matchingJobs.length > 0 
                ? `Found ${matchingJobs.length} jobs matching your skills` 
                : "No matching jobs found. Try updating your skills or checking back later."
        });
    } catch (err) {
        console.error("Error in getMyMatches:", err);
        res.status(500).json({ 
            message: "Error fetching matches", 
            error: err.message,
            alert: "Failed to find matching jobs"
        });
    }
};

// POST /api/jobs/:id/apply → Apply for a job
exports.applyJob = async (req, res) => {
    try {
        // Check if user has permission to apply to jobs
        const applicant = await User.findById(req.user.id);
        if (!applicant) {
            return res.status(404).json({ 
                message: "User not found",
                alert: "Your account could not be found"
            });
        }

        // Only employees can apply to jobs
        if (applicant.userType === 'employer') {
            return res.status(403).json({ 
                message: "Employers cannot apply to jobs",
                alert: "Employers cannot apply to jobs. Use your employer dashboard to find workers instead."
            });
        }

        if (applicant.userType !== 'employee' && applicant.userType !== 'both') {
            return res.status(403).json({ 
                message: "Employee profile required",
                alert: "You need an employee profile to apply to jobs"
            });
        }

        const job = await Job.findById(req.params.id).populate('postedBy');
        if (!job) {
            return res.status(404).json({ 
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // Check if the employer account still exists
        if (!job.postedBy) {
            return res.status(404).json({ 
                message: "Employer account not found",
                alert: "The employer who posted this job no longer exists"
            });
        }

        // Prevent users from applying to their own jobs
        if (job.postedBy._id.toString() === req.user.id) {
            return res.status(400).json({ 
                message: "Cannot apply to own job",
                alert: "You cannot apply to your own job posting"
            });
        }

        if (!job.isOpen) {
            return res.status(400).json({ 
                message: "Job is closed",
                alert: "This job is no longer accepting applications"
            });
        }

        // Check if user has already applied (including rejected applications)
        const existingApplication = job.applicants.find(a => a.user.toString() === req.user.id);
        
        if (existingApplication) {
            if (existingApplication.status === 'rejected') {
                return res.status(400).json({ 
                    message: "Application was rejected",
                    alert: "Your application to this job was rejected. You cannot reapply."
                });
            }
            
            return res.status(400).json({ 
                message: "Already applied",
                alert: "You've already applied to this job"
            });
        }

        job.applicants.push({ 
            user: req.user.id,
            appliedAt: new Date()
        });
        await job.save();

        await createNotification({
            recipient: job.postedBy._id,
            type: 'job_applied',
            message: `${applicant.firstName} ${applicant.lastName} applied to your job "${job.title}"`,
            relatedJob: job._id
        });

        await createNotification({
            recipient: req.user.id,
            type: 'application_sent',
            message: `You applied to "${job.title}"`,
            relatedJob: job._id
        });

        res.status(200).json({ 
            message: "Application submitted",
            jobId: job._id,
            jobTitle: job.title,
            employer: job.postedBy.firstName + ' ' + job.postedBy.lastName,
            alert: "Application sent successfully!"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error applying", 
            error: err.message,
            alert: "Failed to apply. Please try again."
        });
    }
};

// DELETE /api/jobs/:id/cancel-application → Cancel job application
exports.cancelApplication = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ 
                message: "Unauthorized: no user info",
                alert: "Please log in again to cancel your application"
            });
        }

        const job = await Job.findById(req.params.id).populate('postedBy');
        if (!job) {
            return res.status(404).json({ 
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // First try direct string comparison
        const applicationIndex = job.applicants.findIndex(a => 
            a.user && (a.user.toString() === req.user.id || a.user === req.user.id)
        );
        
        if (applicationIndex === -1) {
            return res.status(400).json({ 
                message: "No application found",
                error: "CANCEL_APPLICATION_NOT_FOUND",
                applicants: job.applicants.map(a => ({
                    userId: a.user ? a.user.toString() : 'undefined',
                    status: a.status
                })),
                alert: "You haven't applied to this job"
            });
        }

        // Check if application is already accepted or rejected
        const application = job.applicants[applicationIndex];
        if (application.status === 'accepted') {
            return res.status(400).json({ 
                message: "Cannot cancel accepted application",
                alert: "Your application has already been accepted and cannot be cancelled"
            });
        }

        // Remove the application
        job.applicants.splice(applicationIndex, 1);
        await job.save();

        const applicant = await User.findById(req.user.id);
        
        // Send notifications (don't let notification failures affect the main operation)
        try {
            if (applicant) {
                // Notify employer
                await createNotification({
                    recipient: job.postedBy._id,
                    type: 'application_cancelled',
                    message: `${applicant.firstName} ${applicant.lastName} cancelled their application for "${job.title}"`,
                    relatedJob: job._id
                });

                // Notify applicant
                await createNotification({
                    recipient: req.user.id,
                    type: 'application_cancelled',
                    message: `You cancelled your application for "${job.title}"`,
                    relatedJob: job._id
                });
            }
        } catch (notificationError) {
            console.error('Error sending cancel notifications:', notificationError);
            // Continue execution - don't fail the main operation due to notification issues
        }

        res.status(200).json({ 
            message: "Application cancelled successfully",
            jobId: job._id,
            jobTitle: job.title,
            alert: "Application cancelled successfully!"
        });
    } catch (err) {
        console.error('Cancel application error:', err);
        res.status(500).json({ 
            message: "Error cancelling application", 
            error: err.message,
            alert: "Failed to cancel application. Please try again."
        });
    }
};

// POST /api/jobs/:id/assign → Assign worker to a job
exports.assignWorker = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('postedBy');
        if (!job) {
            console.log('Job not found:', req.params.id);
            return res.status(404).json({ 
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // ✅ Fix postedBy comparison - ensure both are strings
        const jobPostedById = job.postedBy._id.toString();
        const currentUserId = req.user.id.toString();
        
        if (jobPostedById !== currentUserId) {
            console.log('Authorization failed:', {
                jobPostedBy: jobPostedById,
                requestUserId: currentUserId
            });
            return res.status(403).json({ 
                message: "Not authorized",
                alert: "You can only assign workers to your own jobs"
            });
        }

        // ✅ Ensure userId was provided
        const { userId } = req.body;
        console.log('Requested userId to assign:', userId);
        if (!userId) {
            console.log('Missing userId in request body');
            return res.status(400).json({
                message: "Missing userId",
                alert: "You must provide the applicant's userId"
            });
        }

        // ✅ Check applicant
        const isApplicant = job.applicants.some(a => a.user.toString() === userId);
        if (!isApplicant) {
            return res.status(400).json({ 
                message: "User didn't apply",
                alert: "You can only assign workers who applied to this job"
            });
        }

        job.assignedTo = userId;
        job.isOpen = false;
        job.status = 'assigned';

        job.applicants = job.applicants.map(a => ({
            ...a.toObject(),
            status: a.user.toString() === userId ? 'accepted' : 'rejected'
        }));

        await job.save();

        const worker = await User.findById(userId);

        await createNotification({
            recipient: userId,
            type: 'job_accepted',
            message: `You've been assigned to "${job.title}"`,
            relatedJob: job._id
        });

        if (worker.notificationPreferences?.sms) {
            await sendSMS(
                userId,
                `You got the job: ${job.title}. Contact ${job.postedBy.firstName} at ${job.postedBy.mobileNo}`
            );
        }

        res.status(200).json({ 
            message: "Worker assigned successfully",
            job: {
                id: job._id,
                title: job.title,
                assignedTo: worker.firstName + ' ' + worker.lastName
            },
            alert: "Worker assigned and notified"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error assigning worker", 
            error: err.message,
            alert: "Failed to assign worker"
        });
    }
};


// GET /api/jobs/search → Search jobs with filters
exports.search = async (req, res) => {
    try {
        const { keyword, skill, barangay, minPrice, maxPrice, sortBy = 'datePosted', order = 'desc', page = 1, limit = 10 } = req.query;
        
        console.log('🔍 Search Request:', { keyword, skill, barangay, minPrice, maxPrice });
        
        // Only show open, non-deleted, and non-completed jobs
        let query = { isOpen: true, isDeleted: false, completed: false };
        
        // Keyword search across title and description
        if (keyword && keyword.trim()) {
            query.$or = [
                { title: { $regex: keyword.trim(), $options: 'i' } },
                { description: { $regex: keyword.trim(), $options: 'i' } }
            ];
        }
        
        if (skill) query.skillsRequired = { $in: skill.split(',') };
        if (barangay) query.barangay = { $regex: barangay, $options: 'i' };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        console.log('📊 Final Query:', JSON.stringify(query, null, 2));

        const sortOptions = {};
        sortOptions[sortBy] = order === 'asc' ? 1 : -1;

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('postedBy', 'firstName lastName')
                .populate('applicants.user', '_id'),
            Job.countDocuments(query)
        ]);

        // Filter out jobs where the employer account no longer exists
        const validJobs = jobs.filter(job => job.postedBy !== null);

        res.status(200).json({
            success: true,
            data: validJobs,
            filters: {
                keyword,
                skill,
                barangay,
                priceRange: { minPrice, maxPrice }
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: validJobs.length,
                pages: Math.ceil(validJobs.length / limit)
            },
            sortedBy: `${sortBy} (${order})`,
            alert: validJobs.length ? `Found ${validJobs.length} jobs` : "No jobs found matching your criteria"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error searching jobs", 
            error: err.message,
            alert: "Job search failed"
        });
    }
};

exports.getPopularJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isOpen: true, isDeleted: false, completed: false })
      .populate('postedBy', 'firstName lastName')
      .sort({ applicants: -1, datePosted: -1 })
      .limit(10)
      .lean()
      .maxTimeMS(5000);
    
    res.status(200).json({
      success: true,
      jobs: jobs || []
    });
  } catch (err) {
    console.error('Error fetching popular jobs:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching popular jobs",
      error: err.message,
      jobs: []
    });
  }
};

exports.getEmployerCompletedJobs = async (req, res) => {
  try {
    const { employerId } = req.params;
    
    // Find all completed jobs posted by this employer
    const jobs = await Job.find({
      postedBy: employerId,
      isCompleted: true,
      isDeleted: false
    })
    .populate('assignedWorker', 'firstName lastName email')
    .populate('postedBy', 'firstName lastName')
    .sort({ datePosted: -1 })
    .lean();

    // Get ratings for each job
    const Rating = require('../models/Rating');
    const jobsWithRatings = await Promise.all(jobs.map(async (job) => {
      if (job.assignedWorker) {
        const rating = await Rating.findOne({
          job: job._id,
          ratedUser: job.assignedWorker._id
        }).lean();
        
        return {
          ...job,
          rating: rating || null
        };
      }
      return job;
    }));

    res.status(200).json({
      success: true,
      jobs: jobsWithRatings || [],
      count: jobsWithRatings.length
    });
  } catch (err) {
    console.error('Error fetching employer completed jobs:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching completed jobs",
      alert: "Failed to load employer's completed jobs",
      jobs: []
    });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    // First fetch all jobs where the user has applied (exclude deleted jobs)
    const allApplicationJobs = await Job.find({
      'applicants.user': req.user.id,
      isDeleted: { $ne: true }
    })
    .populate('postedBy', 'firstName lastName')
    .sort({ datePosted: -1 });
    
    // Filter the jobs into active applications and history
    const activeApplications = [];
    const applicationHistory = [];
    
    allApplicationJobs.forEach(job => {
      const userApplication = job.applicants.find(a => 
        a.user && a.user.toString() === req.user.id
      );
      
      // Determine if this is an active application or part of history
      // Active = job is open, not completed, and application is pending
      const isActive = job.isOpen && !job.completed && userApplication && userApplication.status === 'pending';
      
      // Add the job to the appropriate list
      if (isActive) {
        activeApplications.push(job);
      } else {
        // Include the application status in the history items
        const statusInfo = {
          status: userApplication ? userApplication.status : 'unknown',
          isOpen: job.isOpen,
          completed: job.completed || false,
          assignedToMe: job.assignedTo && job.assignedTo.toString() === req.user.id
        };
        applicationHistory.push({ ...job.toObject(), applicationInfo: statusInfo });
      }
    });
    
    res.status(200).json({
      activeApplications,
      applicationHistory,
      // For backward compatibility, return the active applications as the main array
      // This will be used by existing code that expects a simple array
      ...activeApplications
    });
  } catch (err) {
    console.error('Error in getMyApplications:', err);
    res.status(500).json({
      message: "Error fetching user applications",
      error: err.message
    });
  }
};

// GET /api/jobs/my-jobs → Get jobs posted by current user
exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id })
      .populate('postedBy', 'firstName lastName')
      .populate('applicants.user', 'firstName lastName email mobileNo')
      .populate('assignedTo', 'firstName lastName')
      .sort({ datePosted: -1 });
    
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching your jobs",
      error: err.message
    });
  }
};

// GET /api/jobs/my-applications-received → Get applications for user's jobs
exports.getMyApplicationsReceived = async (req, res) => {
  try {
    const jobs = await Job.find({ 
      postedBy: req.user.id,
      'applicants.0': { $exists: true } // Only jobs with applicants
    })
    .populate('applicants.user', 'firstName lastName email mobileNo skills')
    .sort({ datePosted: -1 });
    
    res.status(200).json(jobs);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching applications",
      error: err.message
    });
  }
};

// PUT /api/jobs/:id/close → Close a job
exports.closeJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ 
        message: "Job not found",
        alert: "This job is no longer available"
      });
    }

    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: "Not authorized",
        alert: "You can only close your own jobs"
      });
    }

    job.isOpen = false;
    job.status = 'closed';
    await job.save();

    res.status(200).json({ 
      message: "Job closed successfully",
      job,
      alert: "Job has been closed"
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error closing job", 
      error: err.message,
      alert: "Failed to close job"
    });
  }
};

// PUT /api/jobs/:id/complete → Mark a job as completed and transfer income to worker's active goal
exports.completeJob = async (req, res) => {
    try {
        console.log('completeJob called for job ID:', req.params.id);
        console.log('Payment proof file:', req.file);
        
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName');
        
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job no longer exists"
            });
        }
        
        // Check authorization - only job poster or admin can mark as complete
        const jobPostedById = job.postedBy._id.toString();
        const currentUserId = req.user.id.toString();
        
        if (jobPostedById !== currentUserId && req.user.userType !== 'admin') {
            return res.status(403).json({
                message: "Not authorized",
                alert: "You can only mark your own jobs as completed"
            });
        }
        
        // Check if job has an assigned worker
        if (!job.assignedTo) {
            return res.status(400).json({
                message: "No worker assigned",
                alert: "You must assign a worker to the job before marking it as completed"
            });
        }
        
        // Check if job is already completed
        if (job.completed) {
            return res.status(400).json({
                message: "Job already completed",
                alert: "This job has already been marked as completed"
            });
        }

        // Check if payment proof was uploaded
        if (!req.file) {
            return res.status(400).json({
                message: "Payment proof required",
                alert: "Please upload an image or receipt showing proof of payment to the worker"
            });
        }
        
        // Mark job as completed and save payment proof
        job.completed = true;
        job.completedAt = new Date();
        job.isOpen = false;
        job.status = 'completed';
        job.paymentProof = req.file.path; // Cloudinary URL
        await job.save();
        
        // Add the job income to the worker's active goal
        const workerId = job.assignedTo._id.toString();
        const jobIncome = job.price;
        
        // Call the addIncomeToActiveGoal function from goalController
        const updatedGoal = await addIncomeToActiveGoal(workerId, jobIncome, job._id);
        
        // Create notification for the worker
        await createNotification({
            recipient: workerId,
            type: 'job_completed',
            message: `Job "${job.title}" has been marked as completed by ${job.postedBy.firstName}`,
            relatedJob: job._id
        });

        // Create notification for the employer
        await createNotification({
            recipient: jobPostedById,
            type: 'job_completed',
            message: `You have successfully completed the job "${job.title}" with ${job.assignedTo.firstName} ${job.assignedTo.lastName}`,
            relatedJob: job._id
        });
        
        // Notify the worker if income was added to their goal
        if (updatedGoal) {
            await createNotification({
                recipient: workerId,
                type: 'goal_income_added',
                message: `₱${jobIncome} from job "${job.title}" was added to your goal: ${updatedGoal.description}`,
                relatedJob: job._id
            });
            
            // If the goal was completed, send a special notification
            if (updatedGoal.completed) {
                await createNotification({
                    recipient: workerId,
                    type: 'goal_completed_job',
                    message: `Your job completion helped you reach your goal: ${updatedGoal.description}!`,
                    relatedJob: job._id
                });
            }
        }
        
        res.status(200).json({
            message: "Job marked as completed",
            job: {
                id: job._id,
                title: job.title,
                worker: job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : 'Unknown',
                employer: job.postedBy ? `${job.postedBy.firstName} ${job.postedBy.lastName}` : 'Unknown',
                income: jobIncome,
                paymentProof: job.paymentProof
            },
            goalUpdated: !!updatedGoal,
            goal: updatedGoal,
            alert: updatedGoal 
                ? `Job completed and ₱${jobIncome} was added to ${job.assignedTo.firstName}'s financial goal` 
                : "Job completed successfully"
        });
    } catch (err) {
        console.error('Error completing job:', err);
        res.status(500).json({
            message: "Error marking job as completed",
            error: err.message,
            alert: "Failed to complete job"
        });
    }
};

// PUT /api/jobs/:id → Edit a job
exports.editJob = async (req, res) => {
    try {
        // Get the job with populated postedBy field
        const job = await Job.findById(req.params.id).populate('postedBy', '_id');
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job no longer exists"
            });
        }

        console.log('Job found:', {
            jobId: job._id,
            postedBy: job.postedBy ? job.postedBy._id : 'undefined',
            postedByType: job.postedBy ? typeof job.postedBy._id : 'undefined'
        });

        // Get the string representations for safe comparison
        const jobOwnerId = job.postedBy ? job.postedBy._id.toString() : '';
        const currentUserId = req.user.id ? req.user.id.toString() : '';
        
        console.log('ID comparison:', {
            jobOwnerId,
            currentUserId,
            isMatch: jobOwnerId === currentUserId,
            isAdmin: req.user.userType === 'admin'
        });
        
        // Check if the job is owned by the user trying to edit it
        if (jobOwnerId !== currentUserId && req.user.userType !== 'admin') {
            console.log('Authorization failed for job edit');
            return res.status(403).json({ 
                message: "Not authorized",
                alert: "You can only edit your own jobs"
            });
        }

        // Check if the job is already completed
        if (job.completed) {
            return res.status(400).json({
                message: "Cannot edit completed job",
                alert: "This job is already completed and cannot be edited"
            });
        }

        // Validate required fields
        const { title, description, price, barangay } = req.body;
        if (!title || !description || !price || !barangay) {
            return res.status(400).json({
                message: "Missing required fields",
                required: ["title", "description", "price", "barangay"],
                alert: "Please fill all required fields"
            });
        }

        // Update job fields
        job.title = title;
        job.description = description;
        job.price = price;
        job.barangay = barangay;
        
        // Optional fields
        if (req.body.skillsRequired) job.skillsRequired = req.body.skillsRequired;
        
        await job.save();

        res.status(200).json({
            message: "Job updated successfully",
            job: job,
            alert: "Job has been updated"
        });
    } catch (err) {
        console.error('Error in editJob:', err);
        
        // Provide a more helpful error message
        let errorMessage = "Failed to update job";
        if (err.name === 'CastError' && err.kind === 'ObjectId') {
            errorMessage = "Invalid job ID format";
        } else if (err.message.includes('not authorized')) {
            errorMessage = "Not authorized to edit this job";
        }
        
        res.status(500).json({ 
            message: "Error updating job", 
            error: err.message,
            alert: errorMessage
        });
    }
};

// DELETE /api/jobs/:id → Delete a job
exports.deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            // Instead of error, return success (idempotent delete)
            return res.status(200).json({
                message: "Job already deleted",
                alert: "Job has been deleted"
            });
        }

        // Get the string representations for safe comparison
        const jobOwnerId = job.postedBy ? job.postedBy.toString() : '';
        const currentUserId = req.user.id ? req.user.id.toString() : '';
        
        console.log('ID comparison:', {
            jobOwnerId,
            currentUserId,
            isMatch: jobOwnerId === currentUserId,
            isAdmin: req.user.userType === 'admin'
        });

        // Check if the job is owned by the user trying to delete it or if user is admin
        if (job.postedBy && jobOwnerId !== currentUserId && req.user.userType !== 'admin') {
            console.log('Authorization failed for job deletion:', {
                jobPostedBy: jobOwnerId,
                requestUserId: currentUserId,
                userType: req.user.userType
            });
            return res.status(403).json({ 
                message: "Not authorized",
                alert: "You can only delete your own jobs"
            });
        }

        // Soft delete - update job as deleted instead of removing
        await Job.findByIdAndUpdate(req.params.id, { 
            isDeleted: true,
            deletedAt: new Date()
        });
        console.log('Job successfully soft-deleted:', req.params.id);

        // Create activity log for the deletion
        await createActivityLog({
            userId: req.user.id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            type: 'job_delete',
            description: `User deleted job: ${job.title}`,
            metadata: {
                jobId: job._id,
                title: job.title,
                isSoftDelete: true
            }
        });

        res.status(200).json({ 
            message: "Job deleted successfully",
            alert: "Job has been deleted"
        });
    } catch (err) {
        console.error('Error in deleteJob:', err);
        
        // Provide a more helpful error message
        let errorMessage = "Failed to delete job";
        if (err.name === 'CastError' && err.kind === 'ObjectId') {
            errorMessage = "Invalid job ID format";
        } else if (err.message.includes('not authorized')) {
            errorMessage = "Not authorized to delete this job";
        }
        
        res.status(500).json({ 
            message: "Error deleting job", 
            error: err.message,
            alert: errorMessage
        });
    }
};

// POST /api/jobs/:id/reject → Reject an application
exports.rejectApplication = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy');
    if (!job) {
      console.log('Job not found:', req.params.id);
      return res.status(404).json({ 
        message: "Job not found",
        alert: "This job is no longer available"
      });
    }

    // Ensure consistent string comparison
    const jobPostedById = job.postedBy._id.toString();
    const currentUserId = req.user.id.toString();
    
    if (jobPostedById !== currentUserId) {
      console.log('Authorization failed:', {
        jobPostedBy: jobPostedById,
        requestUserId: currentUserId,
        match: jobPostedById === currentUserId
      });
      return res.status(403).json({ 
        message: "Not authorized",
        alert: "You can only manage applications for your own jobs"
      });
    }

    const { userId } = req.body;
    console.log('Requested userId to reject:', userId);
    if (!userId) {
      console.log('Missing userId in request body');
      return res.status(400).json({
        message: "Missing userId",
        alert: "You must provide the applicant's userId"
      });
    }

    const applicationIndex = job.applicants.findIndex(a => a.user.toString() === userId);
    if (applicationIndex === -1) {
      return res.status(400).json({ 
        message: "Application not found",
        alert: "This user hasn't applied to this job"
      });
    }

    job.applicants[applicationIndex].status = 'rejected';
    await job.save();

    const worker = await User.findById(userId);
    await createNotification({
      recipient: userId,
      type: 'application_rejected',
      message: `Your application for "${job.title}" was not selected`,
      relatedJob: job._id
    });

    res.status(200).json({ 
      message: "Application rejected successfully",
      job: {
        id: job._id,
        title: job.title,
        rejectedApplicant: worker ? `${worker.firstName} ${worker.lastName}` : 'Unknown'
      },
      alert: "Application rejected and applicant notified"
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error rejecting application", 
      error: err.message,
      alert: "Failed to reject application"
    });
  }
};

// PUT /api/jobs/:jobId/applicants/:userId → Update applicant status (for admin use)
exports.updateApplicantStatus = async (req, res) => {
    try {
        const { jobId, userId } = req.params;
        const { status } = req.body;

        if (!['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                message: "Invalid status",
                alert: "Status must be pending, accepted, or rejected"
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // Allow admin or job poster to update applicant status
        if (job.postedBy.toString() !== req.user.id && req.user.userType !== 'admin') {
            return res.status(403).json({
                message: "Not authorized",
                alert: "You can only manage applicants for your own jobs"
            });
        }

        // Find and update the applicant
        const applicantIndex = job.applicants.findIndex(a => a.user.toString() === userId);
        if (applicantIndex === -1) {
            return res.status(404).json({
                message: "Applicant not found",
                alert: "This user did not apply to this job"
            });
        }

        job.applicants[applicantIndex].status = status;

        // If accepting, assign the job and reject others
        if (status === 'accepted') {
            job.assignedTo = userId;
            job.isOpen = false;
            job.status = 'assigned';
            
            // Reject all other applicants
            job.applicants = job.applicants.map(a => ({
                ...a.toObject(),
                status: a.user.toString() === userId ? 'accepted' : 'rejected'
            }));
        }

        await job.save();

        // Create notification for the applicant
        await createNotification({
            recipient: userId,
            type: 'application_update',
            message: `Your application for "${job.title}" has been ${status}`,
            relatedJob: job._id
        });

        res.status(200).json({
            success: true,
            message: `Applicant ${status} successfully`,
            job,
            alert: `Application ${status} successfully`
        });
    } catch (err) {
        console.error('Error updating applicant status:', err);
        res.status(500).json({
            success: false,
            message: "Error updating applicant status",
            error: err.message,
            alert: "Failed to update applicant status"
        });
    }
};

// PUT /api/jobs/:jobId/applicants/:userId → Update applicant status (for admin use)
exports.updateApplicantStatus = async (req, res) => {
    try {
        const { jobId, userId } = req.params;
        const { status } = req.body;

        if (!['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                message: "Invalid status",
                alert: "Status must be pending, accepted, or rejected"
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // Allow admin or job poster to update applicant status
        if (job.postedBy.toString() !== req.user.id && req.user.userType !== 'admin') {
            return res.status(403).json({
                message: "Not authorized",
                alert: "You can only manage applicants for your own jobs"
            });
        }

        // Find and update the applicant
        const applicantIndex = job.applicants.findIndex(a => a.user.toString() === userId);
        if (applicantIndex === -1) {
            return res.status(404).json({
                message: "Applicant not found",
                alert: "This user did not apply to this job"
            });
        }

        job.applicants[applicantIndex].status = status;

        // If accepting, assign the job and reject others
        if (status === 'accepted') {
            job.assignedTo = userId;
            job.isOpen = false;
            job.status = 'assigned';
            
            // Reject all other applicants
            job.applicants = job.applicants.map(a => ({
                ...a.toObject(),
                status: a.user.toString() === userId ? 'accepted' : 'rejected'
            }));
        }

        await job.save();

        // Create notification for the applicant
        await createNotification({
            recipient: userId,
            type: 'application_update',
            message: `Your application for "${job.title}" has been ${status}`,
            relatedJob: job._id
        });

        res.status(200).json({
            success: true,
            message: `Applicant ${status} successfully`,
            job,
            alert: `Application ${status} successfully`
        });
    } catch (err) {
        console.error('Error updating applicant status:', err);
        res.status(500).json({
            success: false,
            message: "Error updating applicant status",
            error: err.message,
            alert: "Failed to update applicant status"
        });
    }
};
// POST /api/jobs/:id/invite → Invite a worker to a job
exports.inviteWorker = async (req, res) => {
    try {
        console.log('Invite worker API called with params:', {
            id: req.params.id,
            workerId: req.body.workerId,
            userId: req.user?.id
        });
        
        const { id } = req.params;
        const { workerId } = req.body;

        // Validate input
        if (!workerId) {
            console.log('Missing workerId in request body');
            return res.status(400).json({
                message: "Missing workerId",
                alert: "Worker ID is required"
            });
        }

        // Find the job
        const job = await Job.findById(id).populate('postedBy', 'firstName lastName');
        if (!job) {
            console.log(`Job not found with ID: ${id}`);
            return res.status(404).json({
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // Check authorization - only job poster can invite
        if (job.postedBy._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Not authorized",
                alert: "You can only invite workers to your own jobs"
            });
        }

        // Check if job is still open
        if (!job.isOpen) {
            return res.status(400).json({
                message: "Job is closed",
                alert: "This job is no longer accepting applications"
            });
        }

        // Find the worker
        const worker = await User.findById(workerId);
        if (!worker) {
            return res.status(404).json({
                message: "Worker not found",
                alert: "This worker does not exist"
            });
        }

        // Check if worker has right type
        if (worker.userType !== 'employee' && worker.userType !== 'both') {
            return res.status(400).json({
                message: "Invalid worker type",
                alert: "This user cannot be invited to jobs"
            });
        }

        // Check if already invited (based on notifications)
        try {
            console.log('Checking for existing invitation with:', {
                workerId,
                jobId: id
            });
            
            let recipientId, relatedJobId;
            try {
                recipientId = new mongoose.Types.ObjectId(workerId);
                relatedJobId = new mongoose.Types.ObjectId(id);
            } catch (error) {
                console.error('Error converting IDs to ObjectId:', error);
                recipientId = workerId;
                relatedJobId = id;
            }
            
            const alreadyInvited = await mongoose.connection.collection('notifications').findOne({
                recipient: recipientId,
                type: 'job_invitation',
                relatedJob: relatedJobId
            });
            
            console.log('Existing invitation check result:', alreadyInvited ? 'Found' : 'Not found');

            if (alreadyInvited) {
                return res.status(400).json({
                    message: "Already invited",
                    alert: "This worker has already been invited to this job"
                });
            }
        } catch (error) {
            console.error('Error checking for existing invitation:', error);
            // Continue with invitation process even if check fails
        }

        // Create notification for the worker
        try {
            console.log('Creating notification for worker:', {
                workerId,
                jobTitle: job.title,
                jobId: job._id
            });
            
            await createNotification({
                recipient: workerId,
                type: 'job_invitation',
                message: `You've been invited to apply for "${job.title}" by ${job.postedBy.firstName} ${job.postedBy.lastName}`,
                relatedJob: job._id
            });
            
            console.log('Notification created successfully');

            // Send SMS notification if worker has enabled it
            if (worker.notificationPreferences?.sms) {
                try {
                    await sendSMS(
                        workerId,
                        `Job invitation: "${job.title}" (₱${job.price}) in ${job.barangay}. Check your notifications to apply.`
                    );
                    console.log('SMS notification sent');
                } catch (smsError) {
                    console.error('Error sending SMS notification:', smsError);
                    // Continue even if SMS fails
                }
            }

            res.status(200).json({
                success: true,
                message: "Invitation sent successfully",
                alert: `Invitation sent to ${worker.firstName} ${worker.lastName}`
            });
        } catch (notificationError) {
            console.error('Error creating notification:', notificationError);
            
            // Still return success to the client if everything else worked
            res.status(200).json({
                success: true,
                message: "Invitation processed",
                alert: `Invitation processed for ${worker.firstName} ${worker.lastName}`,
                notificationError: notificationError.message
            });
        }
    } catch (err) {
        console.error('Error inviting worker:', err);
        res.status(500).json({
            message: "Error inviting worker",
            error: err.message,
            alert: "Failed to send invitation"
        });
    }
};

// GET /api/jobs/my-invitations → Get job invitations for the logged-in user
exports.getMyInvitations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all job_invitation notifications for this user
        const Notification = mongoose.model('Notification');
        const invitations = await Notification.find({
            recipient: userId,
            type: 'job_invitation'
        })
        .populate('relatedJob')
        .sort({ createdAt: -1 });

        // Filter out invitations where the job no longer exists or is closed
        const validInvitations = invitations.filter(inv => 
            inv.relatedJob && 
            inv.relatedJob.isOpen && 
            !inv.relatedJob.isDeleted
        );

        res.status(200).json({
            success: true,
            data: validInvitations
        });
    } catch (err) {
        console.error('Error fetching invitations:', err);
        res.status(500).json({
            message: "Error fetching invitations",
            error: err.message
        });
    }
};

// POST /api/jobs/:id/accept-invitation → Accept a job invitation
exports.acceptInvitation = async (req, res) => {
    try {
        const { id } = req.params; // job ID
        const userId = req.user.id;

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        if (!job.isOpen) {
            return res.status(400).json({
                message: "Job is closed",
                alert: "This job is no longer accepting applications"
            });
        }

        // Check if already applied
        const alreadyApplied = job.applicants.some(
            app => app.user.toString() === userId
        );

        if (alreadyApplied) {
            return res.status(400).json({
                message: "Already applied",
                alert: "You have already applied to this job"
            });
        }

        // Add user to applicants with 'accepted' status since they're accepting an invitation
        job.applicants.push({
            user: userId,
            status: 'pending' // Still needs employer to review
        });

        await job.save();

        // Mark the invitation notification as read
        const Notification = mongoose.model('Notification');
        await Notification.updateOne(
            {
                recipient: userId,
                type: 'job_invitation',
                relatedJob: id
            },
            { isRead: true }
        );

        // Create notification for employer
        await createNotification({
            recipient: job.postedBy,
            type: 'job_application',
            message: `${req.user.firstName || 'A user'} accepted your job invitation and applied for "${job.title}"`,
            relatedJob: job._id
        });

        res.status(200).json({
            success: true,
            message: "Invitation accepted",
            alert: "You've successfully applied to this job!"
        });
    } catch (err) {
        console.error('Error accepting invitation:', err);
        res.status(500).json({
            message: "Error accepting invitation",
            error: err.message,
            alert: "Failed to accept invitation"
        });
    }
};

// POST /api/jobs/:id/decline-invitation → Decline a job invitation
exports.declineInvitation = async (req, res) => {
    try {
        const { id } = req.params; // job ID
        const userId = req.user.id;

        // Mark the invitation notification as read
        const Notification = mongoose.model('Notification');
        await Notification.updateOne(
            {
                recipient: userId,
                type: 'job_invitation',
                relatedJob: id
            },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: "Invitation declined",
            alert: "Invitation declined successfully"
        });
    } catch (err) {
        console.error('Error declining invitation:', err);
        res.status(500).json({
            message: "Error declining invitation",
            error: err.message
        });
    }
};
