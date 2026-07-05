const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },

  fullName: String,
  avatarUrl: String,
  phone: String,
  gender: { type: String, enum: ['male','female','other'] },
  birthDate: Date,
  bio: String,

  // Gamification & Engagement
  streak: { type: Number, default: 0 },
  lastCheckinDate: { type: Date },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  badges: [{ type: String }],
  
  // Mood Pet
  moodPet: {
    name: { type: String, default: 'Emi' },
    stage: { type: String, enum: ['egg', 'baby', 'teen', 'adult'], default: 'egg' },
    lastInteraction: { type: Date },
    happiness: { type: Number, default: 100 }
  },

  // Personalization
  activeTheme: { type: String, default: 'default' }

}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);
