const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    barangay: { type: String, required: true }
});

module.exports = mongoose.model('Admin', adminSchema);