// Test endpoint to verify Vercel deployment
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.status(200).json({
    success: true,
    message: 'Vercel deployment is working!',
    timestamp: new Date().toISOString(),
    env: {
      nodeVersion: process.version,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      vercelEnv: process.env.VERCEL_ENV || 'not-vercel'
    }
  });
};
