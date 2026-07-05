const Post = require('../model/Post');
const User = require('../model/Users');
const Profile = require('../model/Profile');
const { normalizePublicMediaUrl } = require('../utils/mediaUrl');

function getPremiumStatus(user) {
    const premiumPlan = String(user?.premiumPlan || user?.plan || 'free').toLowerCase();
    return user?.isPremium === true || premiumPlan !== 'free';
}

function computeAuthorName({ user, profile }) {
    const fromProfile = String(profile?.fullName || '').trim();
    if (fromProfile) return fromProfile;
    const fromUser = String(user?.fullName || user?.displayName || user?.username || '').trim();
    if (fromUser) return fromUser;
    const email = String(user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0] || 'User';
    return email || 'User';
}

function safeAnonymousName(input) {
    const raw = String(input || '').trim();
    const s = raw.replace(/\s+/g, ' ').slice(0, 50);
    if (s) return s;
    const suffix = Math.floor(100 + Math.random() * 900);
    return `Người lạ #${suffix}`;
}

exports.createPost = async (req, res) => {
    try {
        const { anonymousName, anonymousAvatar, mood, emotion, content, images, imageUrl } = req.body || {};
        const userId = req.user.userId;

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const profile = await Profile.findOne({ userId }).lean();
        const isPremium = getPremiumStatus(user);

        const normalizedImageUrl = normalizePublicMediaUrl(imageUrl, req);
        if (normalizedImageUrl && !isPremium) {
            return res.status(403).json({ message: 'Premium required to upload image posts' });
        }

        const finalAnonName = safeAnonymousName(anonymousName);
        const finalMood = String(emotion || mood || 'neutral').trim() || 'neutral';
        const authorName = computeAuthorName({ user, profile });
        const authorAvatar = String(profile?.avatarUrl || user?.avatarUrl || user?.avatar || '').trim();

        const newPost = new Post({
            userId,
            anonymousName: finalAnonName,
            anonymousAvatar: String(anonymousAvatar || '').trim(),
            authorName,
            authorAvatar,
            authorIsPremium: !!isPremium,
            mood: finalMood,
            content,
            images,
            imageUrl: normalizedImageUrl || undefined
        });

        await newPost.save();
        const doc = newPost.toObject();
        const likes = doc?.reactions?.like ?? 0;
        const sadReactions = doc?.reactions?.sad ?? 0;
        const status = doc?.isHidden ? 'hidden' : doc?.isPending ? 'pending' : 'approved';
        res.status(201).json({
            ...doc,
            imageUrl: normalizePublicMediaUrl(doc.imageUrl || (Array.isArray(doc.images) ? doc.images[0] : undefined), req),
            emotion: doc.mood,
            likes,
            sadReactions,
            status
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getMyPost = async (req, res) => {
    try {
        const userId = req.user.userId;
        const posts = await Post.find({ userId }).sort({ createdAt: -1 }).lean();
        const user = await User.findById(userId).lean();
        const profile = await Profile.findOne({ userId }).lean();
        const isPremium = getPremiumStatus(user);

        const result = posts.map((p) => ({
            ...p,
            authorName: p.authorName || p.anonymousName || safeAnonymousName(''),
            authorAvatar: p.authorAvatar || profile?.avatarUrl || user?.avatarUrl || '',
            authorIsPremium: typeof p.authorIsPremium === 'boolean' ? p.authorIsPremium : !!isPremium,
            imageUrl: normalizePublicMediaUrl(
                p.imageUrl || (Array.isArray(p.images) ? p.images[0] : undefined),
                req
            ),
            emotion: p.mood,
            likes: p?.reactions?.like ?? 0,
            sadReactions: p?.reactions?.sad ?? 0,
            status: p?.isHidden ? 'hidden' : p?.isPending ? 'pending' : 'approved',
        }));

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 }).lean();

        const userIds = [...new Set(posts.map((p) => p.userId?.toString()).filter(Boolean))];
        const users = await User.find({ _id: { $in: userIds } }).lean();
        const profiles = await Profile.find({ userId: { $in: userIds } }).lean();

        const userMap = {};
        for (const u of users) userMap[u._id.toString()] = u;
        const profileMap = {};
        for (const pr of profiles) profileMap[pr.userId.toString()] = pr;

        const result = posts.map((p) => {
            const uid = p.userId?.toString();
            const user = uid ? userMap[uid] : null;
            const profile = uid ? profileMap[uid] : null;
            const computedPremium = getPremiumStatus(user);
            const computedAvatar = String(profile?.avatarUrl || user?.avatarUrl || '').trim();
            const computedName = safeAnonymousName(p.authorName || p.anonymousName || '');

            return {
                ...p,
                authorName: p.authorName || computedName,
                authorAvatar: p.authorAvatar || computedAvatar,
                authorIsPremium: typeof p.authorIsPremium === 'boolean' ? p.authorIsPremium : !!computedPremium,
                imageUrl: normalizePublicMediaUrl(
                    p.imageUrl || (Array.isArray(p.images) ? p.images[0] : undefined),
                    req
                ),
                emotion: p.mood,
                likes: p?.reactions?.like ?? 0,
                sadReactions: p?.reactions?.sad ?? 0,
                status: p?.isHidden ? 'hidden' : p?.isPending ? 'pending' : 'approved',
            };
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;

        const post = await Post.findOneAndDelete({ _id: postId, userId });
        if (!post) {
            return res.status(404).json({ message: 'Post not found or unauthorized' });
        }

        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
