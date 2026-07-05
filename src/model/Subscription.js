const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  plan: { type: String, enum: ['free', 'premium', 'premium_plus'] },

  startDate: Date,
  endDate: Date,

  status: { type: String, enum: ['active','expired','cancelled'] }

}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
