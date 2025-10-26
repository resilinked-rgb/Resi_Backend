const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Detect if running in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.USE_MEMORY_STORAGE === 'true';

let storage;

if (isServerless) {
  console.log('🔧 Using memory storage (serverless environment detected)');
  // Use memory storage for serverless environments (Vercel, AWS Lambda, etc.)
  storage = multer.memoryStorage();
} else {
  console.log('🔧 Using disk storage (local/traditional server environment)');
  // Create directory if it doesn't exist (for local development)
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure disk storage for traditional servers
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create multer instance with optimized settings
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024 // 10MB field size limit
  }
});

module.exports = upload;