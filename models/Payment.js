const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Job and user references
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Payment amount
  amount: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Total amount charged to employer (job price + platform fee)'
  },
  workerAmount: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Amount worker receives (usually same as job price)'
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0,
    comment: 'Platform fee charged (covers PayMongo fees + platform sustainability)'
  },
  currency: {
    type: String,
    default: 'PHP'
  },

  // PayMongo transaction details
  paymongoPaymentIntentId: {
    type: String
  },
  paymongoSourceId: {
    type: String
  },
  paymongoPaymentId: {
    type: String
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['gcash', 'paymaya', 'grab_pay', 'card', 'manual'], // manual = old verification image method
    required: true
  },

  // Payment status
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'succeeded', 'failed', 'cancelled'],
    default: 'pending'
  },

  // Receipt/verification image (for manual payments or as backup)
  receiptImage: {
    type: String, // URL to uploaded receipt/verification image
    default: null
  },

  // Payment metadata
  description: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // PayMongo response data
  paymongoResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Error tracking
  errorMessage: {
    type: String,
    default: null
  },

  // Timestamps
  paidAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
paymentSchema.index({ jobId: 1 });
paymentSchema.index({ employerId: 1 });
paymentSchema.index({ workerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymongoPaymentIntentId: 1 }, { sparse: true });
paymentSchema.index({ paymongoSourceId: 1 }, { sparse: true });

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
