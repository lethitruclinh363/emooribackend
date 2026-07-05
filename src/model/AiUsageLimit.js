const mongoose = require('mongoose');

const AiUsageLimitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    dateKey: { type: String, index: true, required: true },
    weekKey: { type: String, index: true, required: true },
    chatUsed: { type: Number, default: 0 },
    imageUsed: { type: Number, default: 0 },
    planType: { type: String, enum: ['free', 'premium', 'premium_plus'], default: 'free' }
  },
  { timestamps: true }
);

AiUsageLimitSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('AiUsageLimit', AiUsageLimitSchema);
