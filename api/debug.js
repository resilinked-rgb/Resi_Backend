// Debug endpoint to test module loading
module.exports = async (req, res) => {
  const results = {
    success: true,
    modules: {},
    timestamp: new Date().toISOString()
  };

  // Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Test each module
  const modulesToTest = [
    'express',
    'mongoose',
    'cors',
    'dotenv',
    'bcryptjs',
    'jsonwebtoken',
    '../app',
    '../utils/db',
    '../controllers/authController'
  ];

  for (const moduleName of modulesToTest) {
    try {
      require(moduleName);
      results.modules[moduleName] = '✅ OK';
    } catch (error) {
      results.modules[moduleName] = `❌ ${error.message}`;
      results.success = false;
    }
  }

  res.status(200).json(results);
};
