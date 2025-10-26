#!/bin/bash
# render-build.sh - Script for Render build process

echo "====== RESILINKED BACKEND BUILD PROCESS ======"

# 1. Install dependencies
echo "Installing dependencies..."
npm install

# 2. Verify environment variables
echo "Verifying environment variables..."
node verify-env.js

# 3. Create necessary directories
echo "Creating required directories..."
mkdir -p public/uploads/ids
mkdir -p temp
chmod -R 777 public/uploads
chmod -R 777 temp

# 4. Additional checks
echo "Running additional checks..."

# Check if MongoDB connection is valid
echo "Checking MongoDB connection..."
node -e "
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ MONGODB_URI is not set');
  process.exit(1);
}
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('✅ MongoDB connection test successful');
  mongoose.disconnect();
})
.catch(err => {
  console.error('❌ MongoDB connection test failed:', err.message);
  process.exit(1);
});
"

echo "====== BUILD PROCESS COMPLETE ======"
exit 0