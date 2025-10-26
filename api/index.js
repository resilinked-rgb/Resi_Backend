// Vercel serverless function entry point
// Load app.js with detailed error tracking

let app;
let appLoadError;

try {
  console.log('🚀 Loading app.js...');
  app = require('../app');
  console.log('✅ app.js loaded successfully');
} catch (error) {
  console.error('❌ Failed to load app.js:', error);
  appLoadError = error;
}

module.exports = async (req, res) => {
  try {
    // Set CORS headers immediately
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost') || origin.includes('vercel.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cache-Control, Pragma');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // If app failed to load, return error
    if (appLoadError) {
      console.error('❌ Returning app load error');
      return res.status(500).json({
        success: false,
        message: 'Server initialization failed',
        error: appLoadError.message,
        stack: appLoadError.stack,
        alert: 'Server initialization failed. Check Vercel logs for details.'
      });
    }

    // Pass to Express app
    await app(req, res);
  } catch (error) {
    console.error('❌ Function error:', error);
    
    // Ensure CORS headers
    try {
      const origin = req.headers.origin;
      if (origin && (origin.includes('localhost') || origin.includes('vercel.app'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } catch (headerError) {
      console.error('Failed to set headers:', headerError);
    }

    // Send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
        stack: error.stack
      });
    }
  }
};
