const mongoose = require('mongoose');

const PasswordResetOtpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

PasswordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetOtp', PasswordResetOtpSchema);

