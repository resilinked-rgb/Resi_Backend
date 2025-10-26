const PasswordResetToken = require('../models/PasswordResetToken');
const crypto = require('crypto');

/**
 * Create a password reset token for a user.
 * @param {string|ObjectId} userId
 * @returns {Promise<string>} The token
 */
exports.createResetToken = async (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await PasswordResetToken.create({ user: userId, token, expiresAt, used: false });
    return token;
};

/**
 * Verify if a reset token is valid and not expired/used.
 * @param {string} token
 * @returns {Promise<PasswordResetToken|null>}
 */
exports.verifyResetToken = async (token) => {
    return await PasswordResetToken.findOne({ token, used: false, expiresAt: { $gt: new Date() } });
};

/**
 * Mark a reset token as used.
 * @param {string} token
 */
exports.markTokenUsed = async (token) => {
    await PasswordResetToken.findOneAndUpdate({ token }, { used: true });
};