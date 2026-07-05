const mongoose = require('mongoose');

const AiImageGenerationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    originalImageUrl: { type: String, default: '' },
    generatedImageUrl: { type: String, default: '' },
    style: { type: String, default: '' },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiStyle', default: null },
    prompt: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
    isPremiumStyle: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' }
  },
  { timestamps: true }
);

AiImageGenerationSchema.index({ userId: 1, createdAt: -1 });
AiImageGenerationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AiImageGeneration', AiImageGenerationSchema);
