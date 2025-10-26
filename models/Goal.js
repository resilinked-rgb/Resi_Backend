const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetAmount: { type: Number, required: true },
    progress: { type: Number, default: 0 },
    currentAmount: { type: Number, default: 0 },
    description: { type: String },
    completed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    isPriority: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    
    // Soft Delete Information
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
});

// Pre-save hook to calculate progress
goalSchema.pre('save', function(next) {
    if (this.targetAmount > 0) {
        this.progress = (this.currentAmount / this.targetAmount) * 100;
        
        // If progress is 100% or more, mark as completed
        if (this.progress >= 100) {
            this.completed = true;
            this.isActive = false;
            this.completedAt = new Date();
        }
    }
    next();
});

// Add a global query middleware to filter out soft-deleted goals by default
goalSchema.pre('find', function() {
    console.log('[Goal.find] Options:', this.getOptions());
    console.log('[Goal.find] Query conditions:', this.getQuery());
    // Only include non-deleted goals unless explicitly asked for deleted ones
    if (!this.getOptions().includeSoftDeleted) {
        console.log('[Goal.find] Adding isDeleted: false filter');
        this.where({ isDeleted: false });
    } else {
        console.log('[Goal.find] Skipping filter - includeSoftDeleted is true');
    }
});

goalSchema.pre('findOne', function() {
    console.log('[Goal.findOne] Options:', this.getOptions());
    console.log('[Goal.findOne] Query conditions:', this.getQuery());
    // Only include non-deleted goals unless explicitly asked for deleted ones
    if (!this.getOptions().includeSoftDeleted) {
        console.log('[Goal.findOne] Adding isDeleted: false filter');
        this.where({ isDeleted: false });
    } else {
        console.log('[Goal.findOne] Skipping filter - includeSoftDeleted is true');
    }
});

goalSchema.pre('countDocuments', function() {
    // Only count non-deleted goals unless explicitly asked for deleted ones
    if (!this.getOptions().includeSoftDeleted) {
        this.where({ isDeleted: false });
    }
});

module.exports = mongoose.model('Goal', goalSchema);