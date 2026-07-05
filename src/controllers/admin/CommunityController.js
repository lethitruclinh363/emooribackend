const Post = require('../../model/Post');
const User = require('../../model/Users');
const Profile = require('../../model/Profile');
const { normalizePublicMediaUrl } = require('../../utils/mediaUrl');

exports.getPosts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (status === 'approved') {
      query.isHidden = { $ne: true };
      query.isPending = { $ne: true };
    } else if (status === 'pending') {
      query.isPending = true;
    } else if (status === 'hidden') {
      query.isHidden = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Post.countDocuments(query);
    
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get user info for each post
    const userIds = [...new Set(posts.map(p => p.userId?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const profiles = await Profile.find({ userId: { $in: userIds } }).lean();
    
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.userId.toString()] = p; });

    const formattedPosts = posts.map(post => {
      const user = userMap[post.userId?.toString()];
      const profile = profileMap[post.userId?.toString()];
      const premiumPlan = String(user?.premiumPlan || user?.plan || 'free').toLowerCase();
      const isPremium = post.authorIsPremium === true || user?.isPremium === true || premiumPlan !== 'free';
      return {
        _id: post._id,
        userId: post.userId,
        user: profile?.fullName || user?.email?.split('@')[0] || 'Unknown',
        avatar: profile?.avatarUrl || null,
        content: post.content,
        emotion: post.mood || 'neutral',
        imageUrl:
          normalizePublicMediaUrl(
            post.imageUrl || (Array.isArray(post.images) ? post.images[0] : null),
            req
          ) || null,
        premium: !!isPremium,
        reports: post.reportsCount || 0,
        status: post.isHidden ? 'hidden' : post.isPending ? 'pending' : 'approved',
        createdAt: post.createdAt
      };
    });

    return res.status(200).json({
      posts: formattedPosts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.approvePost = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findByIdAndUpdate(
      id,
      { isPending: false, isHidden: false },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    return res.status(200).json({ message: 'Post approved', post });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.hidePost = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findByIdAndUpdate(
      id,
      { isHidden: true, isPending: false },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    return res.status(200).json({ message: 'Post hidden', post });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findByIdAndDelete(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    return res.status(200).json({ message: 'Post deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.banUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndUpdate(
      id,
      { isLocked: true },
      { new: true }
    ).lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({ message: 'User banned', user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
