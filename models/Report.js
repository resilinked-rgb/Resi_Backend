const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

// Validation: At least one of reportedUser or reportedJob must be present
reportSchema.pre('validate', function(next) {
    if (!this.reportedUser && !this.reportedJob) {
        next(new Error('Either reportedUser or reportedJob must be specified'));
    } else if (this.reportedUser && this.reportedJob) {
        next(new Error('Cannot report both a user and a job at the same time'));
    } else {
        next();
    }
});

module.exports = mongoose.model('Report', reportSchema);