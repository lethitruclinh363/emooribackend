const mongoose = require('mongoose');

const HealingContentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Quote', 'Music', 'Meditation', 'Breathing Exercise', 'Motivation', 'Exercise'],
    required: true 
  },
  content: { type: String, default: '' },
  emotion: { 
    type: String, 
    enum: ['happy', 'excited', 'neutral', 'sad', 'anxious', 'stressed', 'tired', 'calm'],
    default: 'neutral' 
  },
  type: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('HealingContent', HealingContentSchema);
