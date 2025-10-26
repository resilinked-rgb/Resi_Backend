const PasswordResetToken = require('../models/Password');
const User = require('../models/User');

exports.getAllTokens = async (req, res) => {
    try {
        const tokens = await PasswordResetToken.find()
            .populate('user', 'email firstName lastName')
            .sort({ expiresAt: -1 });

        res.status(200).json({
            tokens,
            alert: `Found ${tokens.length} reset tokens`
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error fetching tokens", 
            error: err.message,
            alert: "Failed to load reset tokens"
        });
    }
};

exports.deleteToken = async (req, res) => {
    try {
        const token = await PasswordResetToken.findByIdAndDelete(req.params.id);
        if (!token) {
            return res.status(404).json({ 
                message: "Token not found",
                alert: "No token found with that ID"
            });
        }

        res.status(200).json({
            message: "Token deleted",
            deletedToken: {
                id: token._id,
                user: token.user,
                expiresAt: token.expiresAt
            },
            alert: "Reset token deleted"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error deleting token", 
            error: err.message,
            alert: "Failed to delete reset token"
        });
    }
};

exports.markAsUsed = async (req, res) => {
    try {
        const token = await PasswordResetToken.findByIdAndUpdate(
            req.params.id,
            { used: true },
            { new: true }
        );

        if (!token) {
            return res.status(404).json({ 
                message: "Token not found",
                alert: "No token found with that ID"
            });
        }

        res.status(200).json({
            message: "Token marked as used",
            token,
            alert: "Reset token marked as used"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error updating token", 
            error: err.message,
            alert: "Failed to update token status"
        });
    }
};