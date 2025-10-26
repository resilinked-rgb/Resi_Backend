
const errorHandler = (err, req, res, next) => {
    // Log the full error object for better debugging
    console.error('Full error object:', err);
    console.error('Error:', {
        message: err && err.message,
        stack: err && err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Ensure CORS headers are set even on errors
    const origin = req.headers.origin;
    if (origin) {
        if (origin.includes('localhost') || origin.includes('vercel.app')) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
        }
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors,
            alert: 'Please check your input data'
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `Duplicate ${field} entered`,
            alert: `This ${field} is already in use`
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            alert: 'Authentication failed. Please login again.'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired',
            alert: 'Session expired. Please login again.'
        });
    }

    // Rate limit error
    if (err.statusCode === 429) {
        return res.status(429).json({
            success: false,
            message: 'Too many requests',
            alert: 'Too many requests, please try again later.'
        });
    }

    // File system errors
    if (err.code === 'ENOENT') {
        return res.status(404).json({
            success: false,
            message: 'File not found',
            alert: 'Requested resource not found'
        });
    }

    // Default error
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    const message = (err && err.message) ? err.message : 'Unknown error occurred';
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
        alert: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: err && err.stack })
    });
};

module.exports = errorHandler;