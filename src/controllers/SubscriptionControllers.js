const Subscription = require('../model/Subscription');
const User = require('../model/Users');


//Gói đăng ký
exports.getSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const subscription = await Subscription.findOne({ userId }).sort({ createdAt: -1 });
        if (!subscription) {
            return res.status(200).json(null);
        }
        res.status(200).json(subscription);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { plan, durationDays } = req.body;
        const nextPlan = ['premium', 'premium_plus'].includes(String(plan)) ? String(plan) : 'premium';

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (durationDays || 30));

        const newSubscription = new Subscription({
            userId,
            plan: nextPlan,
            startDate,
            endDate,
            status: 'active'
        });

        await newSubscription.save();
        
        // Update user plan
        await User.findByIdAndUpdate(
            userId,
            { plan: nextPlan, premiumPlan: nextPlan, isPremium: true },
            { new: true }
        ).lean();

        res.status(201).json(newSubscription);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const subscription = await Subscription.findOneAndUpdate(
            { userId, status: 'active' },
            { status: 'cancelled' },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ message: 'Active subscription not found' });
        }

        // Revert user plan to free
        await User.findByIdAndUpdate(
            userId,
            { plan: 'free', premiumPlan: 'free', isPremium: false },
            { new: true }
        ).lean();

        res.status(200).json(subscription);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find().sort({ createdAt: -1 }).populate('userId', 'email plan role').lean();
        res.status(200).json(subs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
