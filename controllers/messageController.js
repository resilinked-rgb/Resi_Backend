const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');

/**
 * SEND MESSAGE
 * Send a message to another user
 */
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, recipientEmail, subject, content, relatedJobId, parentMessageId } = req.body;

    if ((!recipientId && !recipientEmail) || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        alert: 'Please provide recipient (ID or email), subject, and message content'
      });
    }

    // Find recipient by ID or email
    let recipient;
    if (recipientId) {
      recipient = await User.findById(recipientId);
    } else if (recipientEmail) {
      recipient = await User.findOne({ email: recipientEmail });
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
        alert: 'The user you are trying to message does not exist'
      });
    }

    // Use the found recipient's ID
    const finalRecipientId = recipient._id;

    // Create message
    const message = new Message({
      sender: req.user.id,
      recipient: finalRecipientId,
      subject,
      content,
      relatedJob: relatedJobId || null,
      parentMessage: parentMessageId || null
    });

    await message.save();

    // Populate sender info
    await message.populate('sender', '_id firstName lastName profilePicture');

    // No notification for chat messages (to avoid spam)
    // Users will see new messages in real-time through the chat interface

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      alert: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      alert: 'Failed to send message. Please try again.',
      error: error.message
    });
  }
};

/**
 * GET INBOX MESSAGES
 * Get all messages received by the logged-in user
 */
exports.getInbox = async (req, res) => {
  try {
    const messages = await Message.find({
      recipient: req.user.id,
      deletedBy: { $ne: req.user.id }
    })
      .populate('sender', '_id firstName lastName profilePicture userType')
      .populate('relatedJob', 'title')
      .sort({ createdAt: -1 });

    const unreadCount = messages.filter(msg => !msg.isRead).length;

    res.status(200).json({
      success: true,
      data: {
        messages,
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      alert: 'Failed to load inbox',
      error: error.message
    });
  }
};

/**
 * GET SENT MESSAGES
 * Get all messages sent by the logged-in user
 */
exports.getSentMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      sender: req.user.id,
      deletedBy: { $ne: req.user.id }
    })
      .populate('recipient', '_id firstName lastName profilePicture userType')
      .populate('relatedJob', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get sent messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sent messages',
      alert: 'Failed to load sent messages',
      error: error.message
    });
  }
};

/**
 * GET CONVERSATION
 * Get all messages between two users
 */
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, recipient: userId },
        { sender: userId, recipient: req.user.id }
      ],
      deletedBy: { $ne: req.user.id }
    })
      .populate('sender', '_id firstName lastName profilePicture')
      .populate('recipient', '_id firstName lastName profilePicture')
      .populate('relatedJob', 'title')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        sender: userId,
        recipient: req.user.id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
      alert: 'Failed to load conversation',
      error: error.message
    });
  }
};

/**
 * MARK MESSAGE AS READ
 * Mark a specific message as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        alert: 'Message not found'
      });
    }

    // Only recipient can mark as read
    if (message.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
        alert: 'You can only mark your own messages as read'
      });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: message
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      alert: 'Failed to update message status',
      error: error.message
    });
  }
};

/**
 * DELETE MESSAGE
 * Soft delete a message (hides it from the user's view)
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        alert: 'Message not found'
      });
    }

    // Only sender or recipient can delete
    if (message.sender.toString() !== req.user.id && 
        message.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
        alert: 'You can only delete your own messages'
      });
    }

    // Add user to deletedBy array
    if (!message.deletedBy.includes(req.user.id)) {
      message.deletedBy.push(req.user.id);
    }

    // If both users have deleted, mark as fully deleted
    if (message.deletedBy.length >= 2) {
      message.isDeleted = true;
    }

    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      alert: 'Message deleted'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      alert: 'Failed to delete message',
      error: error.message
    });
  }
};

/**
 * GET UNREAD COUNT
 * Get count of unread messages
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user.id,
      isRead: false,
      deletedBy: { $ne: req.user.id }
    });

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
};

/**
 * MARK MESSAGES AS SEEN
 * Mark messages in a conversation as seen by the recipient
 */
exports.markAsSeen = async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No message IDs provided'
      });
    }

    // Update messages where the current user is the recipient
    const result = await Message.updateMany(
      {
        _id: { $in: messageIds },
        recipient: req.user.id,
        'seenBy.user': { $ne: req.user.id }
      },
      {
        $push: {
          seenBy: {
            user: req.user.id,
            seenAt: new Date()
          }
        },
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as seen',
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Mark as seen error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as seen',
      error: error.message
    });
  }
};
