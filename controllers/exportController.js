const User = require('../models/User');
const Job = require('../models/Job');
const Rating = require('../models/Rating');
const { generateUserReport, generateJobReport, generateCustomReport } = require('../utils/pdfGenerator');

// Helper function to convert data to CSV format
function convertToCSV(data, fields) {
  if (!data || data.length === 0) return '';
  
  const headers = fields.map(field => `"${field.label}"`).join(',');
  const rows = data.map(item => {
    return fields.map(field => {
      // Handle nested properties
      const value = field.key.split('.').reduce((obj, key) => obj && obj[key], item);
      return `"${value !== undefined && value !== null ? value.toString().replace(/"/g, '""') : ''}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

exports.exportData = async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'pdf', filters } = req.query;
    
    let data;
    let filename;
    let fields;
    let filterParams = {};
    let analytics = null; // Declare analytics before the switch
    
    // Parse filters if provided
    if (filters) {
      try {
        filterParams = JSON.parse(filters);
      } catch (e) {
        return res.status(400).json({ message: "Invalid filters format" });
      }
    }
    
    // Build query based on filters
    let query = {};
    
  switch (type) {
      case 'users':
        // User filters
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
        
        // Date filters
        if (filterParams.startDate || filterParams.endDate) {
          query.createdAt = {};
          if (filterParams.startDate) query.createdAt.$gte = new Date(filterParams.startDate);
          if (filterParams.endDate) query.createdAt.$lte = new Date(filterParams.endDate);
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
        
      case 'jobs':
        // Job filters
        if (filterParams.search) {
          query.$or = [
            { title: new RegExp(filterParams.search, 'i') },
            { description: new RegExp(filterParams.search, 'i') },
            { barangay: new RegExp(filterParams.search, 'i') }
          ];
        }
        if (filterParams.status) query.status = filterParams.status;
        if (filterParams.barangay) query.barangay = filterParams.barangay;
        if (filterParams.minPrice || filterParams.maxPrice) {
          query.price = {};
          if (filterParams.minPrice) query.price.$gte = parseFloat(filterParams.minPrice);
          if (filterParams.maxPrice) query.price.$lte = parseFloat(filterParams.maxPrice);
        }
        
        // Date filters
        if (filterParams.startDate || filterParams.endDate) {
          query.createdAt = {};
          if (filterParams.startDate) query.createdAt.$gte = new Date(filterParams.startDate);
          if (filterParams.endDate) query.createdAt.$lte = new Date(filterParams.endDate);
        }
        
        data = await Job.find(query).populate('postedBy', 'firstName lastName email');
        filename = `resilinked-jobs-${new Date().toISOString().split('T')[0]}`;
        fields = [
          { key: 'title', label: 'Job Title' },
          { key: 'description', label: 'Description' },
          { key: 'price', label: 'Price' },
          { key: 'barangay', label: 'Barangay' },
          { key: 'status', label: 'Status' },
          { key: 'postedBy.firstName', label: 'Posted By First Name' },
          { key: 'postedBy.lastName', label: 'Posted By Last Name' },
          { key: 'createdAt', label: 'Posted Date' }
        ];
        break;
        
      case 'ratings':
        // Rating filters
        if (filterParams.minRating || filterParams.maxRating) {
          query.rating = {};
          if (filterParams.minRating) query.rating.$gte = parseInt(filterParams.minRating);
          if (filterParams.maxRating) query.rating.$lte = parseInt(filterParams.maxRating);
        }
        
        // Date filters
        if (filterParams.startDate || filterParams.endDate) {
          query.createdAt = {};
          if (filterParams.startDate) query.createdAt.$gte = new Date(filterParams.startDate);
          if (filterParams.endDate) query.createdAt.$lte = new Date(filterParams.endDate);
        }
        
        data = await Rating.find(query)
          .populate('rater', 'firstName lastName')
          .populate('ratee', 'firstName lastName');
        filename = `resilinked-ratings-${new Date().toISOString().split('T')[0]}`;
        fields = [
          { key: 'rating', label: 'Rating' },
          { key: 'comment', label: 'Comment' },
          { key: 'rater.firstName', label: 'Rater First Name' },
          { key: 'rater.lastName', label: 'Rater Last Name' },
          { key: 'ratee.firstName', label: 'Rated User First Name' },
          { key: 'ratee.lastName', label: 'Rated User Last Name' },
          { key: 'createdAt', label: 'Rating Date' }
        ];
        break;
        
      case 'analytics':
        // Gather analytics data
        const [
          totalUsers,
          totalJobs,
          totalRatings,
          totalReports
        ] = await Promise.all([
          User.countDocuments(),
          Job.countDocuments(),
          Rating.countDocuments(),
          require('../models/Report').countDocuments()
        ]);

        // User distribution
        const userDistribution = {
          employee: await User.countDocuments({ userType: 'employee' }),
          employer: await User.countDocuments({ userType: 'employer' })
        };
        userDistribution.employeePercentage = totalUsers ? (userDistribution.employee / totalUsers) * 100 : 0;
        userDistribution.employerPercentage = totalUsers ? (userDistribution.employer / totalUsers) * 100 : 0;

        // Job stats
        const jobStats = {
          active: await Job.countDocuments({ status: 'open' }),
          completed: await Job.countDocuments({ status: 'completed' }),
          totalValue: (await Job.aggregate([{ $group: { _id: null, total: { $sum: "$price" } } }]))[0]?.total || 0,
          averagePrice: (await Job.aggregate([{ $group: { _id: null, avg: { $avg: "$price" } } }]))[0]?.avg || 0
        };

        // Popular barangays
        const popularBarangays = await Job.aggregate([
          { $group: { _id: "$barangay", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $project: { barangay: "$_id", count: 1, _id: 0 } }
        ]);

        // Recent activity (last 6 jobs or users)
        const recentJobs = await Job.find().sort({ createdAt: -1 }).limit(3);
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(3);
        const recentActivity = [
          ...recentJobs.map(j => ({ type: 'job', description: `Job posted: ${j.title}`, createdAt: j.createdAt })),
          ...recentUsers.map(u => ({ type: 'user', description: `User registered: ${u.firstName} ${u.lastName}`, createdAt: u.createdAt }))
        ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

        // System performance (mocked for now)
        const performance = {
          responseTime: '142ms',
          uptime: '99.8%',
          errorRate: '0.2%',
          activeSessions: 23
        };

      analytics = {
          totalUsers,
          totalJobs,
          totalRatings,
          totalReports,
          userDistribution,
          jobStats,
          popularBarangays,
          recentActivity,
          performance
        };

        filename = `resilinked-analytics-${new Date().toISOString().split('T')[0]}`;
        break;
      default:
        return res.status(400).json({ message: "Invalid export type" });
    }
    
    // Add filter info to filename
    if (Object.keys(filterParams).length > 0) {
      filename += '-filtered';
    }
    
    if (format === 'csv') {
      if (type === 'analytics') {
        return res.status(400).json({ message: "CSV export not available for analytics" });
      }
      const csv = convertToCSV(data, fields);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    } else if (format === 'pdf') {
      let pdfPath;
      if (type === 'users') {
        pdfPath = await generateUserReport(data, filterParams);
      } else if (type === 'jobs') {
        pdfPath = await generateJobReport(data, filterParams);
      } else if (type === 'ratings') {
        pdfPath = await generateCustomReport(data, `${type.toUpperCase()} REPORT`, fields, filterParams);
      } else if (type === 'analytics') {
        pdfPath = await require('../utils/pdfGenerator').generateAnalyticsReport(analytics, filterParams);
      } else {
        return res.status(400).json({ message: "PDF export not available for this type" });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.download(pdfPath, () => {
        // Clean up the temporary file
        require('fs').unlinkSync(pdfPath);
      });
    } else {
      return res.status(400).json({ message: "Unsupported format" });
    }
  } catch (err) {
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