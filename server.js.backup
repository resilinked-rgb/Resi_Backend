// server.js - Production server with simplified startup
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const goalRoutes = require("./routes/goalRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const passwordResetTokenRoutes = require("./routes/passwordResetRoutes");
const analyticsRoutes = require('./routes/analyticsRoutes');
const activityRoutes = require('./routes/activityRoutes');
const exportRoutes = require('./routes/exportRoutes');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

console.log('🚀 Starting production server...');

// App Initialization (no validation during startup)
const app = express();

// Configure CORS
const configureCors = require('./middleware/corsHandler');
app.use(configureCors());
app.options('*', configureCors());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use("/public", express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reset-tokens", passwordResetTokenRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/export", exportRoutes);

// Health check (no MongoDB check during request)
app.get("/health", async (req, res) => {
  res.status(200).json({
    status: "service_responding",
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Error handler
app.use(errorHandler);

// Start server first (connect to MongoDB in the background)
const server = app.listen(PORT, () => {
  server.timeout = 120000; // 2 minutes
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  
  console.log(`🚀 Production server running on port ${PORT}`);
  console.log('💓 Server is accepting connections');
  
  // Connect to MongoDB after server has started
  console.log('📡 Connecting to MongoDB...');
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 90000,
    maxPoolSize: 15,
    connectTimeoutMS: 60000,
    keepAlive: true,
    keepAliveInitialDelay: 300000
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("⚠️ MongoDB connection error:", err.message);
    // Don't exit, keep server running
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    console.log('Process terminated');
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Don't exit in production
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  // Don't exit in production
});