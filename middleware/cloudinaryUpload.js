const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage configuration for profile pictures
const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'resilinked/profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' }
    ],
    public_id: (req, file) => {
      const userId = req.body.email?.split('@')[0] || Date.now();
      return `profile-${userId}-${Date.now()}`;
    }
  }
});

// Storage configuration for ID documents
const idDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'resilinked/id-documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto' }
    ],
    public_id: (req, file) => {
      const userId = req.body.email?.split('@')[0] || Date.now();
      const prefix = file.fieldname || 'id';
      return `${prefix}-${userId}-${Date.now()}`;
    }
  }
});

// Multer upload middleware for registration (profile + ID documents)
const uploadRegistration = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${file.fieldname}. Only JPEG, PNG, and WebP are allowed.`));
    }
  }
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'idFrontImage', maxCount: 1 },
  { name: 'idBackImage', maxCount: 1 },
  { name: 'barangayClearanceImage', maxCount: 1 }
]);

// Multer upload middleware for profile updates (profile picture only)
const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
}).single('profilePicture');

// Storage configuration for payment receipts
const paymentReceiptStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'resilinked/payment-receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto' }
    ],
    public_id: (req, file) => {
      const jobId = req.params.id || Date.now();
      return `payment-${jobId}-${Date.now()}`;
    }
  }
});

// Multer upload middleware for payment proof
const uploadPaymentProof = multer({
  storage: paymentReceiptStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
    }
  }
}).single('paymentProof');

// Helper function to delete old images from Cloudinary
const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
      return; // Not a Cloudinary image
    }
    
    // Extract public_id from Cloudinary URL
    const parts = imageUrl.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0];
    const folder = parts[parts.length - 2];
    const fullPublicId = `resilinked/${folder}/${publicId}`;
    
    await cloudinary.uploader.destroy(fullPublicId);
    console.log(`✅ Deleted old image from Cloudinary: ${fullPublicId}`);
  } catch (error) {
    console.error('⚠️ Error deleting from Cloudinary:', error.message);
    // Don't throw - deletion failure shouldn't block the main operation
  }
};

module.exports = {
  uploadRegistration,
  uploadProfilePicture,
  uploadPaymentProof,
  deleteFromCloudinary,
  cloudinary
};
