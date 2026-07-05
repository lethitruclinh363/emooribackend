const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // không trả về FE

  anonymousName: String,
  anonymousAvatar: String,

  authorName: String,
  authorAvatar: String,
  authorIsPremium: { type: Boolean, default: false },

  mood: {
    type: String,
    enum: ['happy','sad','angry','anxious','neutral']
  },

  content: { type: String, required: true },

  imageUrl: String,
  images: [String],

  isHidden: { type: Boolean, default: false },
  isPending: { type: Boolean, default: false },
  reportsCount: { type: Number, default: 0 },

  reactions: {
    like: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    care: { type: Number, default: 0 }
  },

  reactionsCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 }

}, { timestamps: true });

PostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema, 'posts');
