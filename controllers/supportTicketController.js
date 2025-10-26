const SupportTicket = require('../models/SupportTicket');
const { createNotification } = require('../utils/notificationHelper');
const Admin = require('../models/Admin');

/**
 * CREATE SUPPORT TICKET
 * Allows anyone to submit a support ticket
 */
exports.createSupportTicket = async (req, res) => {
    try {
        const { name, email, subject, message, priority } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                required: ["name", "email", "subject", "message"],
                alert: "Please fill all required fields"
            });
        }

        // Create support ticket
        const ticket = new SupportTicket({
            user: req.user ? req.user.id : null, // Optional - if user is logged in
            name,
            email,
            subject,
            message,
            priority: priority || 'medium' // Default to medium if not provided
        });

        console.log('Creating support ticket:', ticket);
        await ticket.save();
        console.log('Support ticket saved successfully:', ticket._id);

        // Notify all admins about new support ticket
        const admins = await Admin.find();
        for (const admin of admins) {
            await createNotification({
                recipient: admin._id,
                type: 'system',
                message: `New support ticket from ${name}: ${subject}`
            });
        }

        res.status(201).json({
            success: true,
            message: "Support ticket submitted successfully",
            ticket,
            alert: "Support request submitted! We'll get back to you soon."
        });
    } catch (err) {
        console.error('Create support ticket error:', err);
        res.status(500).json({
            success: false,
            message: "Error creating support ticket",
            error: err.message,
            alert: "Failed to submit support request"
        });
    }
};

/**
 * GET ALL SUPPORT TICKETS (Admin only)
 */
exports.getAllSupportTickets = async (req, res) => {
    try {
        const { status, priority } = req.query;
        
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (priority && priority !== 'all') {
            query.priority = priority;
        }

        console.log('Fetching support tickets with query:', query);
        const tickets = await SupportTicket.find(query)
            .populate('user', 'firstName lastName email')
            .populate('resolvedBy', 'username')
            .sort({ createdAt: -1 });

        console.log(`Found ${tickets.length} support tickets`);

        res.status(200).json({
            success: true,
            tickets,
            total: tickets.length,
            alert: `Found ${tickets.length} support tickets`
        });
    } catch (err) {
        console.error('Get support tickets error:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching support tickets",
            error: err.message,
            alert: "Failed to load support tickets"
        });
    }
};

/**
 * GET SINGLE SUPPORT TICKET (Admin only)
 */
exports.getSupportTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('resolvedBy', 'username email');

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Support ticket not found",
                alert: "Ticket not found"
            });
        }

        res.status(200).json({
            success: true,
            ticket,
            alert: "Ticket loaded"
        });
    } catch (err) {
        console.error('Get support ticket error:', err);
        res.status(500).json({
            success: false,
            message: "Error fetching support ticket",
            error: err.message,
            alert: "Failed to load ticket"
        });
    }
};

/**
 * UPDATE SUPPORT TICKET STATUS (Admin only)
 */
exports.updateSupportTicket = async (req, res) => {
    try {
        const { status, priority, adminNotes } = req.body;
        
        const updateData = {};
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;
        if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

        // If status is resolved or closed, set resolvedAt and resolvedBy
        if (status === 'resolved' || status === 'closed') {
            updateData.resolvedAt = Date.now();
            updateData.resolvedBy = req.user.id;
        }

        const ticket = await SupportTicket.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('user', 'firstName lastName email')
         .populate('resolvedBy', 'username');

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Support ticket not found",
                alert: "Ticket not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Support ticket updated successfully",
            ticket,
            alert: "Ticket updated successfully"
        });
    } catch (err) {
        console.error('Update support ticket error:', err);
        res.status(500).json({
            success: false,
            message: "Error updating support ticket",
            error: err.message,
            alert: "Failed to update ticket"
        });
    }
};

/**
 * DELETE SUPPORT TICKET (Admin only)
 */
exports.deleteSupportTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findByIdAndDelete(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Support ticket not found",
                alert: "Ticket not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Support ticket deleted successfully",
            alert: "Ticket deleted successfully"
        });
    } catch (err) {
        console.error('Delete support ticket error:', err);
        res.status(500).json({
            success: false,
            message: "Error deleting support ticket",
            error: err.message,
            alert: "Failed to delete ticket"
        });
    }
};
