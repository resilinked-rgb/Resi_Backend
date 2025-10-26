/**
 * Middleware to handle cache control headers for token verification endpoints
 */
const tokenCacheControl = (req, res, next) => {
    // Set cache headers for token verification responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    next();
};

module.exports = tokenCacheControl;