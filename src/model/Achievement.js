const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  condition: { type: String, required: true },
  xpReward: { type: Number, default: 0 },
  icon: { type: String, default: '🏆' },
  type: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Achievement', AchievementSchema);
