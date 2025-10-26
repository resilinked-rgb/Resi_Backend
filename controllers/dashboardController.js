const User = require('../models/User');
const Job = require('../models/Job');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const mongoose = require('mongoose');

exports.employeeDashboardStats = async (req, res) => {
    try {
        const userId = req.params.id;
        const objectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(objectId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all job-related stats
        const [
            applications,
            offers,
            completedJobs
        ] = await Promise.all([
            Job.countDocuments({ applicants: objectId }),
            Job.countDocuments({ offeredTo: objectId }),
            Job.find({ 
                worker: objectId,
                status: 'completed'
            })
        ]);

        // Calculate total earnings from completed jobs
        const totalEarnings = completedJobs.reduce((sum, job) => sum + (job.price || 0), 0);

        // Calculate average rating
        const ratings = await Rating.find({ ratee: objectId });
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) 
            : 0;

        // Get upcoming payment info if any active jobs
        const activeJob = await Job.findOne({
            worker: objectId,
            status: 'in_progress',
            expectedCompletionDate: { $exists: true }
        }).sort({ expectedCompletionDate: 1 });

        res.status(200).json({
            applications: applications,
            jobOffers: offers,
            profileViews: user.profileViews || 0,
            averageRating: averageRating,
            completedJobs: completedJobs.length,
            totalEarnings: totalEarnings,
            nextPaymentDate: activeJob?.expectedCompletionDate || null
        });
    } catch (err) {
        console.error('Error in employeeDashboardStats:', err);
        res.status(500).json({ 
            message: 'Error fetching employee dashboard stats',
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
const { generateUserReport, generateJobReport, generateRatingReport } = require('../utils/pdfGenerator');
const path = require('path');
const fs = require('fs');

exports.barangayStats = async (req, res) => { /* ...same as before... */ };

// Search/filter users by barangay/keyword
exports.searchUsers = async (req, res) => { /* ...same as before... */ };

// PDF download for users
exports.downloadUsersPdf = async (req, res) => { /* ...same as before... */ };

// --- NEW: JOB SEARCH/FILTER + PDF
exports.searchJobs = async (req, res) => {
    try {
        const { barangay, q, skill, minPrice, maxPrice } = req.query;
        const query = {};
        if (barangay) query.barangay = barangay;
        if (skill) query.skillsRequired = { $in: skill.split(',') };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        if (q) query.title = new RegExp(q, 'i');
        const jobs = await Job.find(query);
        res.status(200).json({ jobs });
    } catch (err) {
        res.status(500).json({ message: "Error searching jobs", error: err.message });
    }
};

exports.downloadJobsPdf = async (req, res) => {
    try {
        const { barangay, q, skill, minPrice, maxPrice } = req.query;
        const query = {};
        if (barangay) query.barangay = barangay;
        if (skill) query.skillsRequired = { $in: skill.split(',') };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        if (q) query.title = new RegExp(q, 'i');
        const jobs = await Job.find(query);
        const filename = generateJobReport(jobs);
        res.download(filename, `ResiLinked-Jobs-${Date.now()}.pdf`, (err) => {
            if (err) console.error('Download error:', err);
            fs.unlinkSync(filename);
        });
    } catch (err) {
        res.status(500).json({ message: "Error generating PDF", error: err.message });
    }
};

// --- NEW: RATING SEARCH/FILTER + PDF
exports.searchRatings = async (req, res) => {
    try {
        const { userId, minRating, maxRating } = req.query;
        const query = {};
        if (userId) query.ratee = userId;
        if (minRating || maxRating) {
            query.rating = {};
            if (minRating) query.rating.$gte = Number(minRating);
            if (maxRating) query.rating.$lte = Number(maxRating);
        }
        const ratings = await Rating.find(query)
            .populate('rater', 'firstName lastName email')
            .populate('ratee', 'firstName lastName email')
            .populate('job', 'title');
        res.status(200).json({ ratings });
    } catch (err) {
        res.status(500).json({ message: "Error searching ratings", error: err.message });
    }
};

exports.downloadRatingsPdf = async (req, res) => {
    try {
        const { userId, minRating, maxRating } = req.query;
        const query = {};
        if (userId) query.ratee = userId;
        if (minRating || maxRating) {
            query.rating = {};
            if (minRating) query.rating.$gte = Number(minRating);
            if (maxRating) query.rating.$lte = Number(maxRating);
        }
        const ratings = await Rating.find(query)
            .populate('rater', 'firstName lastName email')
            .populate('ratee', 'firstName lastName email')
            .populate('job', 'title');
        const filename = generateRatingReport(ratings);
        res.download(filename, `ResiLinked-Ratings-${Date.now()}.pdf`, (err) => {
            if (err) console.error('Download error:', err);
            fs.unlinkSync(filename);
        });
    } catch (err) {
        res.status(500).json({ message: "Error generating PDF", error: err.message });
    }
};

// --- ADMIN-ONLY: EDIT/DELETE USERS/JOBS/RATINGS/REPORTS ---
// These should be protected with admin middleware

exports.adminEditUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ user });
    } catch (err) {
        res.status(500).json({ message: "Error editing user", error: err.message });
    }
};
exports.adminDeleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ deletedId: user?._id });
    } catch (err) {
        res.status(500).json({ message: "Error deleting user", error: err.message });
    }
};
exports.adminEditJob = async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ job });
    } catch (err) {
        res.status(500).json({ message: "Error editing job", error: err.message });
    }
};
exports.adminDeleteJob = async (req, res) => {
    try {
        const job = await Job.findByIdAndDelete(req.params.id);
        res.status(200).json({ deletedId: job?._id });
    } catch (err) {
        res.status(500).json({ message: "Error deleting job", error: err.message });
    }
};
exports.adminEditRating = async (req, res) => {
    try {
        const rating = await Rating.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ rating });
    } catch (err) {
        res.status(500).json({ message: "Error editing rating", error: err.message });
    }
};
exports.adminDeleteRating = async (req, res) => {
    try {
        const rating = await Rating.findByIdAndDelete(req.params.id);
        res.status(200).json({ deletedId: rating?._id });
    } catch (err) {
        res.status(500).json({ message: "Error deleting rating", error: err.message });
    }
};
exports.adminEditReport = async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ report });
    } catch (err) {
        res.status(500).json({ message: "Error editing report", error: err.message });
    }
};
exports.adminDeleteReport = async (req, res) => {
    try {
        const report = await Report.findByIdAndDelete(req.params.id);
        res.status(200).json({ deletedId: report?._id });
    } catch (err) {
        res.status(500).json({ message: "Error deleting report", error: err.message });
    }
};