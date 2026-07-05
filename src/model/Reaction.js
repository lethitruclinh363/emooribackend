const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  type: { type: String, enum: ['like','love','care','sad'] }

}, { timestamps: true });

ReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Reaction', ReactionSchema);
