const express = require('express');
const router = express.Router();
const supportTicketController = require('../controllers/supportTicketController');
const auth = require('../middleware/auth');

// Public: Create support ticket (anyone can submit)
router.post('/', supportTicketController.createSupportTicket);

// Admin: Get all support tickets
router.get('/', auth.verify, auth.verifyAdmin, supportTicketController.getAllSupportTickets);

// Admin: Get single support ticket
router.get('/:id', auth.verify, auth.verifyAdmin, supportTicketController.getSupportTicket);

// Admin: Update support ticket
router.patch('/:id', auth.verify, auth.verifyAdmin, supportTicketController.updateSupportTicket);

// Admin: Delete support ticket
router.delete('/:id', auth.verify, auth.verifyAdmin, supportTicketController.deleteSupportTicket);

module.exports = router;
