const AiChatMessage = require('../../model/AiChatMessage');
const AiUsageLimit = require('../../model/AiUsageLimit');
const AiImageGeneration = require('../../model/AiImageGeneration');
const AiStyle = require('../../model/AiStyle');
const User = require('../../model/Users');

const aiUsageService = require('../../services/ai/aiUsageService');
const aiPromptService = require('../../services/ai/aiPromptService');

async function ensureDefaultStyles() {
  const defaults = aiPromptService.getDefaultStyles();
  for (const s of defaults) {
    await AiStyle.updateOne(
      { name: s.name },
      { $setOnInsert: s },
      { upsert: true }
    );
  }
}

exports.getUsage = async (req, res) => {
  try {
    const dateKey = aiUsageService.getDateKey();
    const weekKey = aiUsageService.getIsoWeekKey();

    const [chatAgg, imageAgg] = await Promise.all([
      AiUsageLimit.aggregate([
        { $match: { dateKey } },
        { $group: { _id: null, total: { $sum: '$chatUsed' }, users: { $sum: 1 } } }
      ]),
      AiUsageLimit.aggregate([
        { $match: { weekKey } },
        { $group: { _id: null, total: { $sum: '$imageUsed' }, users: { $sum: 1 } } }
      ])
    ]);

    const totalChatToday = Number(chatAgg?.[0]?.total || 0);
    const totalImageThisWeek = Number(imageAgg?.[0]?.total || 0);

    const topChat = await AiUsageLimit.find({ dateKey })
      .sort({ chatUsed: -1 })
      .limit(10)
      .lean();

    const topImage = await AiUsageLimit.find({ weekKey })
      .sort({ imageUsed: -1 })
      .limit(10)
      .lean();

    const userIds = Array.from(
      new Set(
        [...topChat.map((x) => String(x.userId)), ...topImage.map((x) => String(x.userId))].filter(Boolean)
      )
    );
    const users = await User.find({ _id: { $in: userIds } }).select('email plan role').lean();
    const userMap = {};
    users.forEach((u) => {
      userMap[String(u._id)] = u;
    });

    return res.status(200).json({
      dateKey,
      weekKey,
      totalChatToday,
      totalImageThisWeek,
      topChat: topChat.map((x) => ({
        userId: x.userId,
        email: userMap[String(x.userId)]?.email || '',
        plan: userMap[String(x.userId)]?.plan || 'free',
        chatUsed: x.chatUsed || 0
      })),
      topImage: topImage.map((x) => ({
        userId: x.userId,
        email: userMap[String(x.userId)]?.email || '',
        plan: userMap[String(x.userId)]?.plan || 'free',
        imageUsed: x.imageUsed || 0
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getChatLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
    const q = String(req.query?.q || '').trim();
    const plan = String(req.query?.plan || '').trim();
    const role = String(req.query?.role || '').trim();
    const emotion = String(req.query?.emotion || '').trim();
    const status = String(req.query?.status || '').trim();
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();

    const match = {};
    if (role === 'user' || role === 'assistant') match.role = role;
    if (emotion) match.detectedEmotion = emotion;

    if (from || to) {
      const range = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + 1);
          range.$lt = d;
        }
      }
      if (Object.keys(range).length) match.createdAt = range;
    }

    if (status === 'safety') {
      match.role = 'assistant';
      match.recommendedActions = 'talk_to_friend';
    } else if (status === 'normal') {
      match.$or = [{ role: { $ne: 'assistant' } }, { recommendedActions: { $ne: 'talk_to_friend' } }];
    }

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { userEmail: '$user.email', userPlan: '$user.plan' } }
    ];

    if (q) pipeline.push({ $match: { userEmail: { $regex: q, $options: 'i' } } });
    if (plan && ['free', 'premium', 'premium_plus'].includes(plan)) pipeline.push({ $match: { userPlan: plan } });

    const countPipeline = [...pipeline, { $count: 'total' }];
    const itemsPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { user: 0 } }
    ];

    const [countResult, items] = await Promise.all([
      AiChatMessage.aggregate(countPipeline),
      AiChatMessage.aggregate(itemsPipeline)
    ]);

    const totalItems = Number(countResult?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      items: items || [],
      pagination: { page, limit, totalItems, totalPages }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getImageGenerations = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const limit = Math.min(120, Math.max(1, Number(req.query?.limit || 40)));
    const q = String(req.query?.q || '').trim();
    const plan = String(req.query?.plan || '').trim();
    const status = String(req.query?.status || '').trim();
    const style = String(req.query?.style || '').trim();
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();

    const match = {};
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) match.status = status;
    if (style) match.style = { $regex: style, $options: 'i' };

    if (from || to) {
      const range = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + 1);
          range.$lt = d;
        }
      }
      if (Object.keys(range).length) match.createdAt = range;
    }

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { userEmail: '$user.email', userPlan: '$user.plan' } }
    ];

    if (q) pipeline.push({ $match: { userEmail: { $regex: q, $options: 'i' } } });
    if (plan && ['free', 'premium', 'premium_plus'].includes(plan)) pipeline.push({ $match: { userPlan: plan } });

    const countPipeline = [...pipeline, { $count: 'total' }];
    const itemsPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { user: 0 } }
    ];

    const [countResult, items] = await Promise.all([
      AiImageGeneration.aggregate(countPipeline),
      AiImageGeneration.aggregate(itemsPipeline)
    ]);

    const totalItems = Number(countResult?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      items: items || [],
      pagination: { page, limit, totalItems, totalPages }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getStyles = async (req, res) => {
  try {
    await ensureDefaultStyles();
    const items = await AiStyle.find().sort({ isActive: -1, type: 1, createdAt: 1 }).lean();
    return res.status(200).json({ items: items || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createStyle = async (req, res) => {
  try {
    const { name, description, previewImage, promptTemplate, type, isActive } = req.body || {};
    const n = String(name || '').trim();
    const p = String(promptTemplate || '').trim();
    if (!n || !p) return res.status(400).json({ error: 'Thiếu name hoặc promptTemplate' });

    const item = await AiStyle.create({
      name: n,
      description: String(description || ''),
      previewImage: String(previewImage || ''),
      promptTemplate: p,
      type: ['free', 'premium', 'premium_plus'].includes(String(type)) ? String(type) : 'free',
      isActive: isActive !== false
    });
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateStyle = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    if (updates.type && !['free', 'premium', 'premium_plus'].includes(String(updates.type))) {
      delete updates.type;
    }
    const item = await AiStyle.findByIdAndUpdate(id, updates, { new: true });
    if (!item) return res.status(404).json({ error: 'Style không tồn tại' });
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteStyle = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await AiStyle.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ error: 'Style không tồn tại' });
    return res.status(200).json({ message: 'Đã xóa style' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleStyle = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await AiStyle.findById(id);
    if (!item) return res.status(404).json({ error: 'Style không tồn tại' });
    item.isActive = !item.isActive;
    await item.save();
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
