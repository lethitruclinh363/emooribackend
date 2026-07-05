const mongoose = require('mongoose');
const Comment = require("../model/Comment");
const Post = require('../model/Post');
const User = require('../model/Users');

exports.getAllComment = async (req, res) => {
   try {
      const comments = await Comment.find();

      res.status(200).json({
         success: true,
         count: comments.length,
         data: comments
      });

   } catch (error) {
      res.status(500).json({
         success: false,
         message: error.message
      });
   }
};

exports.getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid postId' });
    }

    const comments = await Comment.find({ postId }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.createComment = async (req, res) => {
  try {
    const { postId, content, anonymousName, anonymousAvatar } = req.body;

    const userId = req.user?.userId;

    // Validate 
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    if (!postId) {
      return res.status(400).json({ message: "PostId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid postId' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.plan !== 'premium') {
      return res.status(403).json({ message: 'Premium required' });
    }

    // Tạo comment
    const newComment = await Comment.create({
      postId,
      userId,
      anonymousName,
      anonymousAvatar,
      content
    });

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    res.status(201).json({
      success: true,
      data: newComment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(id);

  
    if (!comment) {
      return res.status(404).json({
        message: "Comment not found"
      });
    }

    //  Không phải chủ comment
    if (req.user?.role !== 'admin' && req.user && comment.userId && comment.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this comment"
      });
    }

    await Comment.findByIdAndDelete(id);
    await Post.findByIdAndUpdate(comment.postId, [
      {
        $set: {
          commentsCount: {
            $max: [
              0,
              {
                $add: [
                  { $ifNull: ['$commentsCount', 0] },
                  -1
                ]
              }
            ]
          }
        }
      }
    ], { updatePipeline: true });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    //  Check ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    //  Check content
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    const comment = await Comment.findById(id);

    //  Không tìm thấy
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    //  Không phải chủ comment
    if (req.user?.role !== 'admin' && req.user && comment.userId && comment.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to update this comment"
      });
    }

   
    comment.content = content;
    await comment.save();

    res.status(200).json({
      success: true,
      data: comment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
