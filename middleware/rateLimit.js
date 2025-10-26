const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Too many login attempts, please try again later',
        alert: 'Too many attempts, please wait 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
});

const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 export requests per hour
    message: {
        success: false,
        message: 'Too many export requests, please try again later',
        alert: 'Export limit exceeded, please wait 1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { loginLimiter, exportLimiter };