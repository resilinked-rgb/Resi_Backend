const jwt = require('jsonwebtoken');
const User = require('../models/User');

const secret = process.env.JWT_SECRET || "resilinked-secret";

// Log warning if default secret is used
if (!process.env.JWT_SECRET) {
    console.warn("⚠️ WARNING: Using default JWT secret. Set JWT_SECRET in environment variables!");
}

// Verify JWT and attach user info
exports.verify = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: no token provided" 
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: invalid token format" 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, secret);

        // Check if user exists in database
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: user not found" 
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(403).json({ 
                success: false,
                message: "Account not verified. Please verify your account first." 
            });
        }

        // Attach complete user info to request
        // Convert ObjectId to string to ensure consistent comparisons
        req.user = {
            id: user._id.toString(), // Convert to string explicitly
            email: user.email,
            userType: user.userType,
            firstName: user.firstName,
            lastName: user.lastName,
            isVerified: user.isVerified
        };

        next();

    } catch (err) {
        // Log all errors for debugging
        console.error('Auth middleware error:', err.name, err.message);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: "Token expired. Please login again." 
            });
        }
        
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token. Please login again." 
            });
        }

        // Handle MongoDB connection errors more gracefully
        if (err.name === 'MongooseError' || err.message.includes('buffering timed out')) {
            console.error('❌ MongoDB connection issue during auth');
            return res.status(503).json({ 
                success: false,
                message: "Service temporarily unavailable. Please try again." 
            });
        }

        return res.status(401).json({ 
            success: false,
            message: "Authentication failed" 
        });
    }
};

// Optional: admin check without DB query
exports.verifyAdmin = (req, res, next) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: "Admin access required" 
        });
    }
    next();
};

// JWT creation
exports.createAccessToken = (user) => {
    return jwt.sign(
        { 
            id: user._id, 
            email: user.email, 
            userType: user.userType 
        },
        secret,
        { expiresIn: '30d' }  // Changed from 12h to 30 days
    );
};
