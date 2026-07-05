const mongoose = require('mongoose');

const AiStyleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    previewImage: { type: String, default: '' },
    promptTemplate: { type: String, required: true },
    type: { type: String, enum: ['free', 'premium', 'premium_plus'], default: 'free', index: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

AiStyleSchema.index({ isActive: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AiStyle', AiStyleSchema);
