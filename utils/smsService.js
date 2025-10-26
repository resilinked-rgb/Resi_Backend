const twilio = require('twilio');
const User = require('../models/User');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendSMS = async (userId, message) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.mobileNo) return false;

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+63${user.mobileNo.substring(1)}` // Convert to international format
    });

    return true;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
};

exports.sendVerificationSMS = async (userId, verificationCode) => {
  const message = `Your ResiLinked verification code is: ${verificationCode}`;
  return this.sendSMS(userId, message);
};

exports.sendJobAssignmentSMS = async (userId, jobTitle) => {
  const message = `You've been assigned to a new job: "${jobTitle}". Login to your ResiLinked account for details.`;
  return this.sendSMS(userId, message);
};

exports.sendPaymentConfirmationSMS = async (userId, amount) => {
  const message = `Payment of ₱${amount} has been confirmed for your completed job. Thank you for using ResiLinked!`;
  return this.sendSMS(userId, message);
};