const mongoose = require('mongoose');

const AiChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    message: { type: String, required: true },
    detectedEmotion: { type: String, default: null },
    emotionScore: { type: Number, default: null },
    suggestions: { type: [String], default: [] },
    recommendedActions: { type: [String], default: [] }
  },
  { timestamps: true }
);

AiChatMessageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AiChatMessage', AiChatMessageSchema);
