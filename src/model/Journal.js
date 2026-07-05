const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  title: String,

  text: { type: String, required: true },

  mood: {
    type: String,
    enum: ['happy','sad','angry','anxious','neutral']
  },

  isPrivate: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('Journal', JournalSchema);