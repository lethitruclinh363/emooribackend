const User = require('../../model/Users');
const Profile = require('../../model/Profile');
const Subscription = require('../../model/Subscription');

exports.getUsers = async (req, res) => {
  try {
    const { search, premium, status, page = 1, limit = 10 } = req.query;
    
    const query = { role: 'user' };
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (premium === 'true') {
      query.plan = { $in: ['premium', 'premium_plus'] };
    } else if (premium === 'false') {
      query.plan = 'free';
    }
    
    if (status === 'active') {
      query.isLocked = { $ne: true };
    } else if (status === 'locked') {
      query.isLocked = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get profiles for all users
    const userIds = users.map(u => u._id);
    const profiles = await Profile.find({ userId: { $in: userIds } }).lean();
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.userId.toString()] = p; });

    const formattedUsers = users.map(user => {
      const profile = profileMap[user._id.toString()] || {};
      return {
        _id: user._id,
        email: user.email,
        avatar: profile.avatarUrl || null,
        name: profile.fullName || user.email.split('@')[0],
        level: profile.level || 1,
        xp: profile.xp || 0,
        streak: profile.streak || 0,
        premium: user.plan === 'premium' || user.plan === 'premium_plus',
        status: user.isLocked ? 'locked' : 'active',
        createdAt: user.createdAt
      };
    });

    return res.status(200).json({
      users: formattedUsers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -refreshTokens').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await Profile.findOne({ userId: id }).lean();
    const subscription = await Subscription.findOne({ userId: id }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      user,
      profile: profile || null,
      subscription: subscription || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.lockUser = async (req, res) => {
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
    
    return res.status(200).json({ message: 'User locked', user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndUpdate(
      id, 
      { isLocked: false }, 
      { new: true }
    ).lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({ message: 'User unlocked', user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.grantXp = async (req, res) => {
  try {
    const { id } = req.params;
    const { xp } = req.body;
    
    if (!xp || xp <= 0) {
      return res.status(400).json({ error: 'Invalid XP value' });
    }
    
    const profile = await Profile.findOne({ userId: id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    profile.xp = (profile.xp || 0) + parseInt(xp);
    
    // Level up calculation (every 500 XP = 1 level)
    profile.level = Math.floor(profile.xp / 500) + 1;
    
    await profile.save();
    
    return res.status(200).json({ message: 'XP granted', profile });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.grantPremium = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30, plan = 'premium' } = req.body;
    const nextPlan = ['premium', 'premium_plus'].includes(String(plan)) ? String(plan) : 'premium';
    
    const user = await User.findByIdAndUpdate(
      id,
      { plan: nextPlan, premiumPlan: nextPlan, isPremium: true },
      { new: true }
    ).lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(days));

    await Subscription.updateMany(
      { userId: id, status: 'active' },
      { status: 'cancelled' }
    );
    
    const subscription = await Subscription.findOneAndUpdate(
      { userId: id, status: 'active' },
      {
        $set: {
          plan: nextPlan,
          startDate,
          endDate,
          status: 'active',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    
    return res.status(200).json({ message: 'Premium granted', user, subscription });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.revokePremium = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { plan: 'free', premiumPlan: 'free', isPremium: false },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Subscription.updateMany({ userId: id, status: 'active' }, { status: 'cancelled' });

    return res.status(200).json({ message: 'Premium revoked', user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
