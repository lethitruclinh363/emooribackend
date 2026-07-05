const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  postId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post',
    required: true
  },

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: function () {
      return !this.anonymousName;
    }
  },

  anonymousName: { 
    type: String,
    required: function () {
      return !this.userId;
    }
  },

  anonymousAvatar: {
    type: String,
    default: "default-avatar.png"
  },

  content: { 
    type: String, 
    required: true,
    trim: true
  }

}, { timestamps: true });

CommentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", CommentSchema);