const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
});

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);