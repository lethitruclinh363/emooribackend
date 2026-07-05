const mongoose = require('mongoose');

const MoodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  mood: {
    type: String,
    enum: ['happy','sad','angry','anxious','neutral'],
    required: true
  },

  intensity: { type: Number, min: 1, max: 5 },

  note: String,

  date: { type: Date, default: Date.now }

}, { timestamps: true });

MoodSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Mood', MoodSchema);