const User = require('../../model/Users');
const Profile = require('../../model/Profile');
const Mood = require('../../model/Checkin');
const Subscription = require('../../model/Subscription');
const Post = require('../../model/Post');
const Payment = require('../../model/Payment');
const Theme = require('../../model/Theme');
const Mascot = require('../../model/Mascot');
const Achievement = require('../../model/Achievement');
const HealingContent = require('../../model/HealingContent');

exports.getDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic counts
    const totalUsers = await User.countDocuments({ role: 'user' });
    const premiumUsers = await User.countDocuments({ role: 'user', plan: { $in: ['premium', 'premium_plus'] } });
    
    // DAU - Daily Active Users (users who checked in today)
    const dau = await Mood.countDocuments({ date: { $gte: startOfToday } });
    
    // WAU - Weekly Active Users
    const wau = await Mood.distinct('userId', { date: { $gte: startOfWeek } });
    
    // MAU - Monthly Active Users
    const mau = await Mood.distinct('userId', { date: { $gte: startOfMonth } });

    // Mood check-ins count
    const moodCheckIns = await Mood.countDocuments({});

    // Revenue (sum of successful payments)
    const revenueResult = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const revenue = revenueResult[0]?.total || 0;

    // User growth (last 6 months)
    const userGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const count = await User.countDocuments({ 
        role: 'user',
        createdAt: { $gte: monthStart, $lte: monthEnd } 
      });
      userGrowth.push({
        month: monthStart.toLocaleString('vi-VN', { month: 'short' }),
        users: count
      });
    }

    // Premium growth
    const premiumGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const count = await Subscription.countDocuments({
        status: 'active',
        startDate: { $lte: monthEnd }
      });
      premiumGrowth.push({
        month: monthStart.toLocaleString('vi-VN', { month: 'short' }),
        premium: count
      });
    }

    // Mood distribution
    const moodDistribution = await Mood.aggregate([
      { $group: { _id: '$mood', count: { $sum: 1 } } }
    ]);
    const moodColors = {
      happy: '#22c55e',
      sad: '#3b82f6',
      angry: '#ef4444',
      anxious: '#f97316',
      neutral: '#facc15'
    };
    const moodDistFormatted = moodDistribution.map(m => ({
      mood: m._id,
      count: m.count,
      color: moodColors[m._id] || '#64748b'
    }));

    // Theme usage
    const themeUsage = await Profile.aggregate([
      { $group: { _id: '$activeTheme', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const themeUsageFormatted = themeUsage.map(t => ({
      theme: t._id || 'default',
      usage: t.count
    }));

    // Mascot usage
    const mascotUsage = await Profile.aggregate([
      { $group: { _id: '$moodPet.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const mascotUsageFormatted = mascotUsage.map(m => ({
      mascot: m._id || 'Unknown',
      usage: m.count
    }));

    return res.status(200).json({
      totalUsers,
      premiumUsers,
      dau,
      wau: wau.length,
      mau: mau.length,
      moodCheckIns,
      revenue,
      userGrowth,
      premiumGrowth,
      moodDistribution: moodDistFormatted,
      themeUsage: themeUsageFormatted,
      mascotUsage: mascotUsageFormatted
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: error.message });
  }
};
