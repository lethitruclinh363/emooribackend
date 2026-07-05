const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  amount: Number,

  method: { type: String, enum: ['momo','vnpay','paypal'] },

  status: { type: String, enum: ['pending','success','failed'] },

  transactionId: String,

  plan: { type: String, default: 'premium' },
  durationDays: { type: Number, default: 30 }

}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);