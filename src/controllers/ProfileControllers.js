const Profile = require('../model/Profile');
const User = require('../model/Users');

function computeDisplayName({ profile, user }) {
    const fullName = String(profile?.fullName || user?.fullName || '').trim();
    if (fullName) return fullName;
    const email = String(user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return email || 'User';
}

function computePremium({ user }) {
    const premiumPlan = String(user?.premiumPlan || user?.plan || 'free').toLowerCase();
    const isPremium = user?.isPremium === true || premiumPlan !== 'free';
    return { isPremium, premiumPlan };
}

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        let profile = await Profile.findOne({ userId });
        
        if (!profile) {
            // Nếu chưa có profile, tự động tạo mới thay vì báo lỗi 404
            profile = new Profile({
                userId,
                bio: 'Xin chào, tôi là người dùng mới!'
            });
            await profile.save();
        }

        const displayName = computeDisplayName({ profile, user });
        const { isPremium, premiumPlan } = computePremium({ user });

        res.status(200).json({
            ...profile.toObject(),
            userId: user?._id,
            email: user?.email,
            userCreatedAt: user?.createdAt,
            userUpdatedAt: user?.updatedAt,
            plan: user?.plan,
            isPremiumField: user?.isPremium === true,
            premiumPlanField: user?.premiumPlan,
            displayName,
            isPremium,
            premiumPlan
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = req.body || {};

        const profile = await Profile.findOneAndUpdate(
            { userId },
            { $set: updates },
            { new: true, upsert: true }
        );

        const allowedUserFields = ['fullName', 'avatarUrl', 'bio', 'gender', 'birthDate'];
        const userUpdates = {};
        for (const key of allowedUserFields) {
            if (updates[key] !== undefined) userUpdates[key] = updates[key];
        }
        if (Object.keys(userUpdates).length > 0) {
            await User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: true }).lean();
        }

        const user = await User.findById(userId).lean();
        const displayName = computeDisplayName({ profile, user });
        const { isPremium, premiumPlan } = computePremium({ user });

        res.status(200).json({
            ...profile.toObject(),
            userId: user?._id,
            email: user?.email,
            userCreatedAt: user?.createdAt,
            userUpdatedAt: user?.updatedAt,
            plan: user?.plan,
            isPremiumField: user?.isPremium === true,
            premiumPlanField: user?.premiumPlan,
            displayName,
            isPremium,
            premiumPlan
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
