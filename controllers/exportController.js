const User = require('../models/User');
const Job = require('../models/Job');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const { generateUserReport, generateJobReport, generateCustomReport, generateAnalyticsReport } = require('../utils/pdfGenerator');

// Helper function to convert data to CSV format
function convertToCSV(data, fields) {
  if (!data || data.length === 0) return '';
  
  const headers = fields.map(field => `"${field.label}"`).join(',');
  const rows = data.map(item => {
    return fields.map(field => {
      // Handle nested properties
      let value = field.key.split('.').reduce((obj, key) => obj && obj[key], item);
      
      // Convert arrays to comma-separated strings
      if (Array.isArray(value)) {
        value = value.join('; ');
      }
      
      // Handle objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      
      // Handle dates
      if (value instanceof Date) {
        value = value.toISOString();
      }
      
      return `"${value !== undefined && value !== null ? value.toString().replace(/"/g, '""') : ''}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

exports.exportData = async (req, res) => {
  try {
    console.log('=== EXPORT REQUEST ===');
    console.log('Type:', req.params.type);
    console.log('Format:', req.query.format);
    console.log('Format type:', typeof req.query.format);
    console.log('Query params:', req.query);
    
    const { type } = req.params;
    const { format = 'csv', q, barangay, role, verified, status, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    console.log('Parsed format variable:', format);
    console.log('Format === "csv":', format === 'csv');
    console.log('Format === "pdf":', format === 'pdf');
    
    let data;
    let filename;
    let fields;
    let query = {};
    let analytics = null;
    
    // Build query based on URL parameters
    switch (type) {
      case 'users':
        // Search query
        if (q) {
          query.$or = [
            { firstName: new RegExp(q, 'i') },
            { lastName: new RegExp(q, 'i') },
            { email: new RegExp(q, 'i') }
          ];
        }
        
        // Filters
        if (role && role !== 'all') query.userType = role;
        if (barangay && barangay !== 'all') query.barangay = barangay;
        if (verified && verified !== 'all') query.isVerified = verified === 'true';
        
        // Fetch data with all details including ID images
        // Exclude heavy/unnecessary fields for export
        data = await User.find(query)
          .select('-password -verificationToken -verificationExpires -goals -bio -description')
          .lean()
          .sort({ [sortBy]: order === 'asc' ? 1 : -1 });
        
        filename = `resilinked-users-${new Date().toISOString().split('T')[0]}`;
        fields = [
          { key: '_id', label: 'User ID' },
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'mobileNo', label: 'Mobile Number' },
          { key: 'userType', label: 'User Type' },
          { key: 'barangay', label: 'Barangay' },
          { key: 'address', label: 'Address' },
          { key: 'gender', label: 'Gender' },
          { key: 'isVerified', label: 'Verified' },
          { key: 'idType', label: 'ID Type' },
          { key: 'idNumber', label: 'ID Number' },
          { key: 'profilePicture', label: 'Profile Picture URL' },
          { key: 'idFrontImage', label: 'ID Front URL' },
          { key: 'idBackImage', label: 'ID Back URL' },
          { key: 'barangayClearanceImage', label: 'Barangay Clearance URL' },
          { key: 'skills', label: 'Skills' },
          { key: 'createdAt', label: 'Registration Date' }
        ];
        break;
        
      case 'jobs':
        // Search query
        if (q) {
          query.$or = [
            { title: new RegExp(q, 'i') },
            { description: new RegExp(q, 'i') },
            { barangay: new RegExp(q, 'i') }
          ];
        }
        
        // Filters
        if (barangay && barangay !== 'all') query.barangay = barangay;
        if (status && status !== 'all') {
          if (status === 'open') query.isOpen = true;
          else if (status === 'closed') { query.isOpen = false; query.isCompleted = { $ne: true }; }
          else if (status === 'completed') query.isCompleted = true;
        }
        
        // Fetch data with employer, employee, and all job details
        data = await Job.find(query)
          .populate('postedBy', 'firstName lastName email mobileNo barangay profilePicture validId')
          .populate('assignedTo', 'firstName lastName email mobileNo barangay profilePicture validId skills')
          .populate('applicants.user', 'firstName lastName email')
          .sort({ [sortBy]: order === 'asc' ? 1 : -1 });
        
        filename = `resilinked-jobs-${new Date().toISOString().split('T')[0]}`;
        fields = [
          { key: '_id', label: 'Job ID' },
          { key: 'title', label: 'Job Title' },
          { key: 'description', label: 'Description' },
          { key: 'price', label: 'Price (PHP)' },
          { key: 'barangay', label: 'Barangay' },
          { key: 'location', label: 'Location' },
          { key: 'skillsRequired', label: 'Skills Required' },
          { key: 'isOpen', label: 'Is Open' },
          { key: 'isCompleted', label: 'Is Completed' },
          { key: 'completed', label: 'Completed' },
          { key: 'postedBy.firstName', label: 'Employer First Name' },
          { key: 'postedBy.lastName', label: 'Employer Last Name' },
          { key: 'postedBy.email', label: 'Employer Email' },
          { key: 'postedBy.mobileNo', label: 'Employer Phone' },
          { key: 'postedBy.barangay', label: 'Employer Location' },
          { key: 'assignedTo.firstName', label: 'Employee First Name' },
          { key: 'assignedTo.lastName', label: 'Employee Last Name' },
          { key: 'assignedTo.email', label: 'Employee Email' },
          { key: 'assignedTo.mobileNo', label: 'Employee Phone' },
          { key: 'assignedTo.skills', label: 'Employee Skills' },
          { key: 'applicants.length', label: 'Number of Applicants' },
          { key: 'paymentProof', label: 'Payment Proof URL' },
          { key: 'completedAt', label: 'Completed Date' },
          { key: 'datePosted', label: 'Date Posted' },
          { key: 'createdAt', label: 'Created Date' }
        ];
        break;
        
      case 'analytics':
        // Fetch comprehensive analytics data
        const [totalUsers, totalJobs, totalRatings, totalReports] = await Promise.all([
          User.countDocuments(),
          Job.countDocuments(),
          Rating.countDocuments(),
          Report.countDocuments()
        ]);

        // Gender distribution
        const genderStats = await User.aggregate([
          { $group: { _id: "$gender", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        
        const genderDistribution = {
          male: genderStats.find(g => g._id === 'male')?.count || 0,
          female: genderStats.find(g => g._id === 'female')?.count || 0,
          others: genderStats.find(g => g._id === 'others' || g._id === 'other')?.count || 0,
          notSpecified: genderStats.find(g => !g._id || g._id === '')?.count || 0
        };

        // Popular skills
        const skillsStats = await User.aggregate([
          { $unwind: "$skills" },
          { $group: { _id: "$skills", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]);
        const popularSkills = skillsStats.map(s => ({ skill: s._id, count: s.count }));

        // Popular jobs
        const popularJobs = await Job.aggregate([
          {
            $addFields: {
              applicantCount: { $size: { $ifNull: ["$applicants", []] } }
            }
          },
          { $sort: { applicantCount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: 'postedBy',
              foreignField: '_id',
              as: 'poster'
            }
          },
          { $unwind: { path: '$poster', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              title: 1,
              barangay: 1,
              price: 1,
              applicantCount: 1,
              posterName: { $concat: ['$poster.firstName', ' ', '$poster.lastName'] }
            }
          }
        ]);

        // Popular barangays
        const popularBarangays = await Job.aggregate([
          { $group: { _id: "$barangay", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $project: { barangay: "$_id", count: 1, _id: 0 } }
        ]);

        // Recent activity
        const recentActivityDocs = await require('../models/Activity').find({})
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();
        const recentActivity = recentActivityDocs.map(a => ({
          _id: a._id,
          type: a.type.includes('job') ? 'job' : 'user',
          description: a.description,
          createdAt: a.createdAt
        }));

        // Job stats
        const completedJobs = await Job.countDocuments({ completed: true });
        const activeJobs = await Job.countDocuments({ isOpen: true, completed: false });
        const jobPrices = await Job.find({}, 'price').lean();
        const totalValue = jobPrices.reduce((sum, job) => sum + (job.price || 0), 0);
        const averagePrice = jobPrices.length > 0 ? Math.round(totalValue / jobPrices.length) : 0;

        // User type distribution
        const userTypeStats = await User.aggregate([
          { $group: { _id: "$userType", count: { $sum: 1 } } }
        ]);
        
        const employeeCount = userTypeStats.find(u => u._id === 'employee')?.count || 0;
        const employerCount = userTypeStats.find(u => u._id === 'employer')?.count || 0;
        const bothCount = userTypeStats.find(u => u._id === 'both')?.count || 0;
        
        // Verified users
        const verifiedCount = await User.countDocuments({ isVerified: true });

        analytics = {
          totalUsers,
          totalJobs,
          totalRatings,
          totalReports,
          userDistribution: {
            employee: employeeCount,
            employer: employerCount,
            both: bothCount,
            employeePercentage: totalUsers > 0 ? Math.round((employeeCount / totalUsers) * 100) : 0,
            employerPercentage: totalUsers > 0 ? Math.round((employerCount / totalUsers) * 100) : 0,
            bothPercentage: totalUsers > 0 ? Math.round((bothCount / totalUsers) * 100) : 0
          },
          genderDistribution,
          verifiedUsers: {
            count: verifiedCount,
            percentage: totalUsers > 0 ? Math.round((verifiedCount / totalUsers) * 100) : 0
          },
          jobStats: {
            active: activeJobs,
            completed: completedJobs,
            totalValue,
            averagePrice
          },
          popularBarangays,
          popularSkills,
          popularJobs,
          recentActivity
        };

        filename = `resilinked-analytics-${new Date().toISOString().split('T')[0]}`;
        // Analytics only supports PDF export
        data = null;
        fields = null;
        break;
        
      default:
        return res.status(400).json({ message: "Invalid export type" });
    }
    
    // Add filter info to filename if filters applied
    const filterApplied = q || barangay !== 'all' || role !== 'all' || verified !== 'all' || status !== 'all';
    if (filterApplied) {
      filename += '-filtered';
    }
    
    if (format === 'csv') {
      // Analytics doesn't support CSV export
      if (type === 'analytics') {
        return res.status(400).json({ message: "Analytics export only supports PDF format" });
      }
      
      console.log('Generating CSV with', data.length, 'records');
      const csv = convertToCSV(data, fields);
      console.log('CSV generated, length:', csv.length);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    } else if (format === 'pdf') {
      console.log('Generating PDF with', data ? data.length : 'analytics', 'records');
      let pdfPath;
      const filterParams = { q, barangay, role, verified, status };
      
      if (type === 'users') {
        console.log('Calling generateUserReport...');
        pdfPath = await generateUserReport(data, filterParams);
      } else if (type === 'jobs') {
        console.log('Calling generateJobReport...');
        pdfPath = await generateJobReport(data, filterParams);
      } else if (type === 'analytics') {
        console.log('Calling generateAnalyticsReport...');
        pdfPath = await generateAnalyticsReport(analytics, filterParams);
      } else {
        return res.status(400).json({ message: "PDF export not available for this type" });
      }
      
      console.log('PDF generated at:', pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.download(pdfPath, `${filename}.pdf`, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Error downloading PDF', error: err.message });
          }
        } else {
          console.log('PDF sent successfully to client');
        }
        // Clean up the temporary file
        try {
          require('fs').unlinkSync(pdfPath);
          console.log('Cleaned up temp PDF:', pdfPath);
        } catch (cleanupErr) {
          console.error('Error deleting temp PDF:', cleanupErr);
        }
      });
    } else {
      return res.status(400).json({ message: "Unsupported format" });
    }
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({
      message: "Error exporting data",
      error: err.message
    });
  }
};

exports.exportFilteredData = async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'pdf', ...filters } = req.body;
    
    let data;
    let filename;
    let fields;
    
    // Build query based on filters
    let query = {};
    
    switch (type) {
      case 'users':
        if (filters.search) {
          query.$or = [
            { firstName: new RegExp(filters.search, 'i') },
            { lastName: new RegExp(filters.search, 'i') },
            { email: new RegExp(filters.search, 'i') }
          ];
        }
        if (filters.userType) query.userType = filters.userType;
        if (filters.barangay) query.barangay = filters.barangay;
        if (filters.verified !== undefined) query.isVerified = filters.verified;
        
        if (filters.startDate || filters.endDate) {
          query.createdAt = {};
          if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
          if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
        }
        
        data = await User.find(query).select('-password -verificationToken -verificationExpires');
        filename = `resilinked-users-${new Date().toISOString().split('T')[0]}`;
        fields = [
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'mobileNo', label: 'Mobile Number' },
          { key: 'userType', label: 'User Type' },
          { key: 'barangay', label: 'Barangay' },
          { key: 'isVerified', label: 'Verified' },
          { key: 'createdAt', label: 'Registration Date' }
        ];
        break;
        
      // Add cases for other types as needed
      default:
        return res.status(400).json({ message: "Invalid export type" });
    }
    
    if (format === 'pdf') {
      const pdfPath = await generateUserReport(data, filters);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.download(pdfPath, () => {
        require('fs').unlinkSync(pdfPath);
      });
    } else {
      return res.status(400).json({ message: "Unsupported format" });
    }
  } catch (err) {
    res.status(500).json({
      message: "Error exporting filtered data",
      error: err.message
    });
  }
};