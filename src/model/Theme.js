const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  type: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  primaryColor: { type: String, default: '#0ea5e9' },
  secondaryColor: { type: String, default: '#06b6d4' },
  gradient: { type: String, default: 'from-sky-400 to-cyan-500' },
  preview: { type: String, default: '🎨' },
  previewColors: { type: [String], default: [] },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Theme', ThemeSchema);
