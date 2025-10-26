const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who is giving the rating
    ratee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who is being rated
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now },
    reported: { type: Boolean, default: false }
});

module.exports = mongoose.model('Rating', ratingSchema);