const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  fullName: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  gender: { type: String, default: '' },
  birthDate: { type: String, default: '' },
  isPremium: { type: Boolean, default: false },
  premiumPlan: { type: String, default: 'free' },

  plan: { 
    type: String, 
    enum: ['free', 'premium', 'premium_plus'], 
    default: 'free' 
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  refreshTokens: [
    {
      tokenHash: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      revokedAt: { type: Date, default: null },
      replacedByTokenHash: { type: String, default: null }
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);

