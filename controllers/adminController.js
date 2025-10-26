const fs = require('fs');
const User = require('../models/User');
const Job = require('../models/Job');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const Activity = require('../models/Activity');
const { generateUserReport } = require('../utils/pdfGenerator');
const { createNotification } = require('../utils/notificationHelper');

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

// Dashboard summary
exports.getDashboard = async (req, res) => {
    try {
        const [totalUsers, totalJobs, totalRatings, totalReports] = await Promise.all([
            User.countDocuments(),
            Job.countDocuments(),
            Rating.countDocuments(),
            Report.countDocuments()
        ]);

        res.status(200).json({ totalUsers, totalJobs, totalRatings, totalReports });
    } catch (err) {
        res.status(500).json({ message: "Dashboard error", error: err.message });
    }
};

// Search/filter users
exports.searchUsers = async (req, res) => {
    try {
        const { q, sortBy = 'lastName', order = 'asc', page = 1, limit = 10 } = req.query;
        let query = {};

        if (q) {
            query.$or = [
                { firstName: new RegExp(q, 'i') },
                { lastName: new RegExp(q, 'i') },
                { email: new RegExp(q, 'i') },
                { mobileNo: new RegExp(q, 'i') }
            ];
        }

        const sortOptions = {};
        sortOptions[sortBy] = order === 'asc' ? 1 : -1;

        const [users, total] = await Promise.all([
            User.find(query)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(limit)
                .select('-password'),
            User.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            searchTerm: q || 'All users',
            sortedBy: `${sortBy} (${order})`,
            alert: `Found ${total} matching users`
        });
    } catch (err) {
        res.status(500).json({ message: "Error searching users", error: err.message, alert: "Search operation failed" });
    }
};

// Delete user (soft delete)
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found", alert: "No user found with that ID" });
        }

        // Soft delete user
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();

        await createNotification({
            recipient: req.user.id,
            type: 'admin_message',
            message: `User ${user.email} has been soft-deleted by ${req.user.email}`
        });

        // Log the action
        await createActivityLog({
            userId: req.user.id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            type: 'user_soft_delete',
            description: `Admin soft-deleted user: ${user.email}`,
            metadata: {
                deletedUserId: user._id,
                deletedUserEmail: user.email,
                deletedUserName: `${user.firstName} ${user.lastName}`
            }
        });

        res.status(200).json({
            message: "User deleted successfully",
            deletedUser: { id: user._id, email: user.email, name: `${user.firstName} ${user.lastName}` },
            alert: "User account has been deactivated"
        });
    } catch (err) {
        res.status(500).json({ message: "Error deleting user", error: err.message, alert: "Failed to delete user account" });
    }
};

// Edit user
exports.editUser = async (req, res) => {
    try {
        const originalUser = await User.findById(req.params.id);
        if (!originalUser) {
            return res.status(404).json({ 
                success: false,
                message: "User not found", 
                alert: "No user found with that ID" 
            });
        }

        // Validate required fields
        const { firstName, lastName, email, userType } = req.body;
        if (!firstName || !lastName || !email || !userType) {
            return res.status(400).json({ 
                success: false,
                message: "Missing required fields", 
                alert: "Please fill in all required fields" 
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { 
                new: true, 
                runValidators: true 
            }
        ).select('-password');

        console.log('User updated successfully:', updatedUser);

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: updatedUser,
            alert: "User profile updated successfully"
        });
    } catch (err) {
        console.error('Error editing user:', err);
        res.status(500).json({ 
            success: false,
            message: "Error editing user", 
            error: err.message, 
            alert: "Failed to update user profile" 
        });
    }
};

// Get all jobs with filtering and pagination for admin
exports.getAllJobs = async (req, res) => {
    try {
        const { q, sortBy = 'datePosted', order = 'desc', page = 1, limit = 10, status, barangay, minPrice, maxPrice, startDate, endDate } = req.query;
        let query = {};

        // Search query
        if (q) {
            query.$or = [
                { title: new RegExp(q, 'i') },
                { description: new RegExp(q, 'i') },
                { barangay: new RegExp(q, 'i') },
                { skillsRequired: { $in: [new RegExp(q, 'i')] } }
            ];
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Barangay filter
        if (barangay) {
            query.barangay = barangay;
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        // Date range filter
        if (startDate || endDate) {
            query.datePosted = {};
            if (startDate) query.datePosted.$gte = new Date(startDate);
            if (endDate) query.datePosted.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const sortOptions = {};
        sortOptions[sortBy] = order === 'asc' ? 1 : -1;

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .populate('postedBy', 'firstName lastName email')
                .populate('assignedTo', 'firstName lastName')
                .populate('applicants.user', 'firstName lastName'),
            Job.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: jobs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            searchTerm: q || 'All jobs',
            sortedBy: `${sortBy} (${order})`,
            alert: `Found ${total} matching jobs`
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error fetching jobs", 
            error: err.message, 
            alert: "Failed to fetch jobs" 
        });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        // First check if job exists
        const job = await Job.findById(req.params.id);
        if (!job) {
            // Idempotent: Return success if job is already deleted
            return res.status(200).json({
                message: "Job already deleted",
                alert: "Job has been deleted"
            });
        }

        // Send notification to job poster
        try {
            await createNotification({
                recipient: job.postedBy,
                type: 'job_update',
                message: `Your job "${job.title}" was removed by admin`
            });
        } catch (notificationErr) {
            console.error('Error sending job deletion notification:', notificationErr);
            // Continue with deletion even if notification fails
        }

        // Soft delete the job
        job.isDeleted = true;
        job.deletedAt = new Date();
        await job.save();
        
        // Log the action
        await createActivityLog({
            userId: req.user.id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            type: 'job_soft_delete_admin',
            description: `Admin soft-deleted job: ${job.title}`,
            metadata: {
                jobId: job._id,
                jobTitle: job.title,
                jobPostedBy: job.postedBy
            }
        });

        res.status(200).json({
            message: "Job deleted successfully",
            deletedJob: { id: job._id, title: job.title, postedBy: job.postedBy },
            alert: "Job has been removed"
        });
    } catch (err) {
        console.error('Admin job deletion error:', err);
        res.status(500).json({ 
            message: "Error deleting job", 
            error: err.message, 
            alert: "Failed to delete job" 
        });
    }
};

// Edit job
exports.editJob = async (req, res) => {
    try {
        const originalJob = await Job.findById(req.params.id);
        if (!originalJob) {
            return res.status(404).json({ 
                success: false,
                message: "Job not found", 
                alert: "No job found with that ID" 
            });
        }

        // Validate required fields
        const { title, description, price, status } = req.body;
        if (!title || !description || price === undefined || !status) {
            return res.status(400).json({ 
                success: false,
                message: "Missing required fields", 
                alert: "Please fill in all required fields" 
            });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { 
                new: true, 
                runValidators: true 
            }
        ).populate('postedBy', 'firstName lastName email');

        console.log('Job updated successfully:', updatedJob);

        res.status(200).json({
            success: true,
            message: "Job updated successfully",
            job: updatedJob,
            alert: "Job updated successfully"
        });
    } catch (err) {
        console.error('Error editing job:', err);
        res.status(500).json({ 
            success: false,
            message: "Error editing job", 
            error: err.message, 
            alert: "Failed to update job" 
        });
    }
};

// ✅ Fixed: Download users as PDF with proper error handling
exports.downloadUsersPdf = async (req, res) => {
    let filename;
    try {
        const users = await User.find().select('-password');
        filename = await generateUserReport(users);

        await createNotification({
            recipient: req.user.id,
            type: 'admin_message',
            message: `User report PDF generated with ${users.length} records`
        });

        res.download(filename, `ResiLinked-Users-${new Date().toISOString().split('T')[0]}.pdf`, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                }
            }
        });

        // Set timeout to clean up file if download doesn't complete
        setTimeout(() => {
            if (filename && fs.existsSync(filename)) {
                fs.unlinkSync(filename);
            }
        }, 300000); // 5 minutes

    } catch (err) {
        // Clean up on error
        if (filename && fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
        res.status(500).json({ 
            message: "Error generating PDF", 
            error: err.message, 
            alert: "Failed to generate user report" 
        });
    }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
    try {
        // Validate if the id is a valid MongoDB ObjectId
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format",
                alert: "The user ID provided is not valid"
            });
        }
        
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                alert: "The requested user could not be found"
            });
        }
        
        return res.status(200).json({
            success: true,
            user,
            alert: "User retrieved successfully"
        });
    } catch (err) {
        console.error("Error retrieving user:", err);
        return res.status(500).json({
            success: false,
            message: "Error retrieving user",
            error: err.message,
            alert: "There was a problem retrieving the user information"
        });
    }
};

// Get user activity
exports.getUserActivity = async (req, res) => {
    try {
        const { id } = req.params;
        // If you have an Activity model, query it here. Otherwise stub it.
        // Example with a hypothetical Activity model:
        // const activities = await Activity.find({ user: id }).sort({ createdAt: -1 });

        const activities = []; // <-- replace with real query when you have Activity model

        res.status(200).json({
            success: true,
            data: activities,
            alert: activities.length
                ? `Found ${activities.length} activities`
                : "No activities for this user"
        });
    } catch (err) {
        console.error("Error fetching user activity:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching user activity",
            error: err.message
        });
    }
};

// Get jobs posted by a user
exports.getUserJobs = async (req, res) => {
    try {
        const { id } = req.params;
        const jobs = await Job.find({ postedBy: id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: jobs,
            alert: jobs.length
                ? `Found ${jobs.length} jobs`
                : "No jobs for this user"
        });
    } catch (err) {
        console.error("Error fetching user jobs:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching user jobs",
            error: err.message
        });
    }
};

// Export all users as JSON/CSV/PDF
exports.exportUsers = async (req, res) => {
    try {
        const { format = 'json', filters, limit = 1000 } = req.query;
        
        // Build query based on filters
        let query = {};
        let filterParams = {};
        
        if (filters) {
            try {
                filterParams = JSON.parse(filters);
            } catch (e) {
                return res.status(400).json({ message: "Invalid filters format" });
            }
        }
        
        // Apply filters if provided
        if (filterParams.search) {
            query.$or = [
                { firstName: new RegExp(filterParams.search, 'i') },
                { lastName: new RegExp(filterParams.search, 'i') },
                { email: new RegExp(filterParams.search, 'i') }
            ];
        }
        if (filterParams.userType) query.userType = filterParams.userType;
        if (filterParams.barangay) query.barangay = filterParams.barangay;
        if (filterParams.verified !== undefined) query.isVerified = filterParams.verified === 'true';
        
        // Add limit to prevent memory issues
        const queryOptions = {};
        if (limit && !isNaN(limit)) {
            queryOptions.limit = parseInt(limit);
        }
        
        const users = await User.find(query, null, queryOptions).select('-password');
        
        if (format === 'csv') {
            const fields = [
                { key: 'firstName', label: 'First Name' },
                { key: 'lastName', label: 'Last Name' },
                { key: 'email', label: 'Email' },
                { key: 'userType', label: 'User Type' },
                { key: 'barangay', label: 'Barangay' },
                { key: 'isVerified', label: 'Verified' },
                { key: 'createdAt', label: 'Date Joined' }
            ];
            
            const csvData = convertToCSV(users, fields);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
            return res.send(csvData);
        } else if (format === 'pdf') {
            // Generate PDF directly as buffer instead of file
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            
            const pdfPromise = new Promise((resolve) => {
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });
            });
            
            // Header
            doc.fontSize(20).text('ResiLinked - User Management Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();
            
            // Summary section
            doc.fontSize(14).text(`Total Users: ${users.length}`, { underline: true });
            doc.moveDown();
            
            // Table header
            const tableTop = doc.y;
            const itemCodeX = 50;
            const nameX = 120;
            const emailX = 220;
            const typeX = 340;
            const barangayX = 400;
            const statusX = 480;
            
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('#', itemCodeX, tableTop);
            doc.text('Name', nameX, tableTop);
            doc.text('Email', emailX, tableTop);
            doc.text('Type', typeX, tableTop);
            doc.text('Barangay', barangayX, tableTop);
            doc.text('Status', statusX, tableTop);
            
            // Draw header line
            doc.moveTo(50, tableTop + 15)
               .lineTo(540, tableTop + 15)
               .stroke();
            
            let currentY = tableTop + 25;
            
            // Table rows
            doc.font('Helvetica');
            users.forEach((user, index) => {
                // Check if we need a new page
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                doc.fontSize(9);
                doc.text(index + 1, itemCodeX, currentY);
                doc.text(`${user.firstName} ${user.lastName}`, nameX, currentY, { width: 90, ellipsis: true });
                doc.text(user.email, emailX, currentY, { width: 110, ellipsis: true });
                doc.text(user.userType, typeX, currentY, { width: 50 });
                doc.text(user.barangay || 'N/A', barangayX, currentY, { width: 70, ellipsis: true });
                doc.text(user.isVerified ? 'Verified' : 'Unverified', statusX, currentY);
                
                currentY += 20;
                
                // Draw row separator every 5 rows
                if ((index + 1) % 5 === 0) {
                    doc.moveTo(50, currentY - 5)
                       .lineTo(540, currentY - 5)
                       .stroke('#CCCCCC');
                }
            });
            
            // Footer
            doc.fontSize(8).text(`Report generated by ResiLinked Admin Dashboard - ${new Date().toISOString()}`, 50, 750, { align: 'center' });
            
            doc.end();
            
            const pdfBuffer = await pdfPromise;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="users-report.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length);
            
            return res.send(pdfBuffer);
        }
        
        // Default JSON response
        res.status(200).json({ success: true, data: users });
    } catch (err) {
        console.error('Export users error:', err);
        res.status(500).json({ success: false, message: "Error exporting users", error: err.message });
    }
};

// Helper function to convert data to CSV format
function convertToCSV(data, fields) {
    if (!data || data.length === 0) return '';
    
    const headers = fields.map(field => `"${field.label}"`).join(',');
    const rows = data.map(item => {
        return fields.map(field => {
            const value = field.key.split('.').reduce((obj, key) => obj && obj[key], item);
            return `"${value !== undefined && value !== null ? value.toString().replace(/"/g, '""') : ''}"`;
        }).join(',');
    });
    
    return [headers, ...rows].join('\n');
}

// Export all jobs
exports.exportJobs = async (req, res) => {
    try {
        const { format = 'json', filters, limit = 1000 } = req.query;
        
        let query = {};
        let filterParams = {};
        
        if (filters) {
            try {
                filterParams = JSON.parse(filters);
            } catch (e) {
                return res.status(400).json({ message: "Invalid filters format" });
            }
        }
        
        // Apply filters if provided
        if (filterParams.search) {
            query.$or = [
                { title: new RegExp(filterParams.search, 'i') },
                { description: new RegExp(filterParams.search, 'i') }
            ];
        }
        if (filterParams.status) query.status = filterParams.status;
        if (filterParams.barangay) query.barangay = filterParams.barangay;
        if (filterParams.minPrice) query.price = { ...query.price, $gte: parseFloat(filterParams.minPrice) };
        if (filterParams.maxPrice) query.price = { ...query.price, $lte: parseFloat(filterParams.maxPrice) };
        
        // Add limit to prevent memory issues
        const queryOptions = {};
        if (limit && !isNaN(limit)) {
            queryOptions.limit = parseInt(limit);
        }
        
        const jobs = await Job.find(query, null, queryOptions).populate('postedBy', 'email firstName lastName');
        
        if (format === 'csv') {
            const fields = [
                { key: 'title', label: 'Title' },
                { key: 'description', label: 'Description' },
                { key: 'price', label: 'Price' },
                { key: 'barangay', label: 'Barangay' },
                { key: 'status', label: 'Status' },
                { key: 'postedBy.email', label: 'Posted By Email' },
                { key: 'datePosted', label: 'Date Posted' }
            ];
            
            const csvData = convertToCSV(jobs, fields);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="jobs.csv"');
            return res.send(csvData);
        } else if (format === 'pdf') {
            // Generate PDF directly as buffer instead of file
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            
            const pdfPromise = new Promise((resolve) => {
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });
            });
            
            // Header
            doc.fontSize(20).text('ResiLinked - Job Management Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();
            
            // Summary section
            doc.fontSize(14).text(`Total Jobs: ${jobs.length}`, { underline: true });
            doc.moveDown();
            
            // Table header
            const tableTop = doc.y;
            const itemCodeX = 50;
            const titleX = 80;
            const priceX = 200;
            const barangayX = 260;
            const statusX = 330;
            const postedByX = 380;
            const dateX = 480;
            
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('#', itemCodeX, tableTop);
            doc.text('Job Title', titleX, tableTop);
            doc.text('Price', priceX, tableTop);
            doc.text('Barangay', barangayX, tableTop);
            doc.text('Status', statusX, tableTop);
            doc.text('Posted By', postedByX, tableTop);
            doc.text('Date', dateX, tableTop);
            
            // Draw header line
            doc.moveTo(50, tableTop + 15)
               .lineTo(540, tableTop + 15)
               .stroke();
            
            let currentY = tableTop + 25;
            
            // Table rows
            doc.font('Helvetica');
            jobs.forEach((job, index) => {
                // Check if we need a new page
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                doc.fontSize(9);
                doc.text(index + 1, itemCodeX, currentY);
                doc.text(job.title, titleX, currentY, { width: 110, ellipsis: true });
                doc.text(`₱${job.price?.toLocaleString() || '0'}`, priceX, currentY, { width: 50 });
                doc.text(job.barangay || 'N/A', barangayX, currentY, { width: 60, ellipsis: true });
                doc.text(job.status || 'Open', statusX, currentY, { width: 40 });
                doc.text(job.postedBy ? `${job.postedBy.firstName} ${job.postedBy.lastName}` : 'Unknown', postedByX, currentY, { width: 90, ellipsis: true });
                doc.text(new Date(job.datePosted || job.createdAt).toLocaleDateString(), dateX, currentY);
                
                currentY += 20;
                
                // Draw row separator every 5 rows
                if ((index + 1) % 5 === 0) {
                    doc.moveTo(50, currentY - 5)
                       .lineTo(540, currentY - 5)
                       .stroke('#CCCCCC');
                }
            });
            
            // Add job details section if there's space or on new page
            if (currentY > 600) {
                doc.addPage();
                currentY = 50;
            } else {
                currentY += 30;
            }
            
            // Job Details Section
            doc.fontSize(14).font('Helvetica-Bold').text('Job Details Summary', 50, currentY);
            currentY += 20;
            
            doc.fontSize(10).font('Helvetica');
            jobs.slice(0, 10).forEach((job, index) => { // Show first 10 jobs in detail
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                
                doc.font('Helvetica-Bold').text(`${index + 1}. ${job.title}`, 50, currentY);
                currentY += 15;
                doc.font('Helvetica');
                doc.text(`Description: ${job.description ? job.description.substring(0, 200) + '...' : 'No description'}`, 60, currentY, { width: 480 });
                currentY += 25;
                doc.text(`Price: ₱${job.price?.toLocaleString() || '0'} | Barangay: ${job.barangay} | Status: ${job.status}`, 60, currentY);
                currentY += 15;
                doc.text(`Posted by: ${job.postedBy ? `${job.postedBy.firstName} ${job.postedBy.lastName} (${job.postedBy.email})` : 'Unknown'}`, 60, currentY);
                currentY += 20;
            });
            
            // Footer
            doc.fontSize(8).text(`Report generated by ResiLinked Admin Dashboard - ${new Date().toISOString()}`, 50, 750, { align: 'center' });
            
            doc.end();
            
            const pdfBuffer = await pdfPromise;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="jobs-report.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length);
            
            return res.send(pdfBuffer);
        }
        
        res.status(200).json({ success: true, data: jobs });
    } catch (err) {
        console.error('Export jobs error:', err);
        res.status(500).json({ success: false, message: "Error exporting jobs", error: err.message });
    }
};

// Export all ratings
exports.exportRatings = async (req, res) => {
    try {
        const { limit = 1000 } = req.query;
        const queryOptions = {};
        if (limit && !isNaN(limit)) {
            queryOptions.limit = parseInt(limit);
        }
        
        const ratings = await Rating.find({}, null, queryOptions).populate('user', 'email firstName lastName');
        res.status(200).json({ success: true, data: ratings });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error exporting ratings", error: err.message });
    }
};
