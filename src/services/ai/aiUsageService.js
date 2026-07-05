const AiUsageLimit = require('../../model/AiUsageLimit');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getDateKey(d = new Date()) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = pad2(dt.getUTCMonth() + 1);
  const day = pad2(dt.getUTCDate());
  return `${y}-${m}-${day}`;
}

function getIsoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

function getPlanType(user) {
  const plan = String(user?.plan || 'free').toLowerCase();
  if (plan === 'premium_plus') return 'premium_plus';
  if (plan === 'premium') return 'premium';
  return 'free';
}

function getLimits(planType) {
  if (planType === 'premium_plus') return { chatDailyLimit: 250, imageWeeklyLimit: 80 };
  if (planType === 'premium') return { chatDailyLimit: 50, imageWeeklyLimit: 30 };
  return { chatDailyLimit: 5, imageWeeklyLimit: 3 };
}

async function syncUsage(userId, planType) {
  const dateKey = getDateKey();
  const weekKey = getIsoWeekKey();

  const existing = await AiUsageLimit.findOne({ userId });
  if (!existing) {
    return AiUsageLimit.create({
      userId,
      dateKey,
      weekKey,
      chatUsed: 0,
      imageUsed: 0,
      planType
    });
  }

  const update = { planType };
  let needsUpdate = false;

  if (existing.dateKey !== dateKey) {
    update.dateKey = dateKey;
    update.chatUsed = 0;
    needsUpdate = true;
  }

  if (existing.weekKey !== weekKey) {
    update.weekKey = weekKey;
    update.imageUsed = 0;
    needsUpdate = true;
  }

  if (!needsUpdate) return existing;

  return AiUsageLimit.findOneAndUpdate({ userId }, update, { new: true });
}

async function consumeChat(user) {
  const planType = getPlanType(user);
  const { chatDailyLimit } = getLimits(planType);

  await syncUsage(user._id, planType);

  const updated = await AiUsageLimit.findOneAndUpdate(
    { userId: user._id, chatUsed: { $lt: chatDailyLimit } },
    { $inc: { chatUsed: 1 }, $set: { planType } },
    { new: true }
  ).lean();

  if (!updated) {
    const cur = await AiUsageLimit.findOne({ userId: user._id }).lean();
    const used = Number(cur?.chatUsed || chatDailyLimit);
    return { allowed: false, remaining: 0, used, limit: chatDailyLimit, planType };
  }

  const used = Number(updated.chatUsed || 0);
  return { allowed: true, remaining: Math.max(0, chatDailyLimit - used), used, limit: chatDailyLimit, planType };
}

async function refundChat(user) {
  const planType = getPlanType(user);
  const { chatDailyLimit } = getLimits(planType);

  await syncUsage(user._id, planType);

  const updated = await AiUsageLimit.findOneAndUpdate(
    { userId: user._id, chatUsed: { $gt: 0 } },
    { $inc: { chatUsed: -1 }, $set: { planType } },
    { new: true }
  ).lean();

  const used = Number(updated?.chatUsed || 0);
  return {
    allowed: true,
    remaining: Math.max(0, chatDailyLimit - used),
    used,
    limit: chatDailyLimit,
    planType
  };
}

async function consumeImage(user) {
  const planType = getPlanType(user);
  const { imageWeeklyLimit } = getLimits(planType);

  await syncUsage(user._id, planType);

  const updated = await AiUsageLimit.findOneAndUpdate(
    { userId: user._id, imageUsed: { $lt: imageWeeklyLimit } },
    { $inc: { imageUsed: 1 }, $set: { planType } },
    { new: true }
  ).lean();

  if (!updated) {
    const cur = await AiUsageLimit.findOne({ userId: user._id }).lean();
    const used = Number(cur?.imageUsed || imageWeeklyLimit);
    return { allowed: false, remaining: 0, used, limit: imageWeeklyLimit, planType };
  }

  const used = Number(updated.imageUsed || 0);
  return { allowed: true, remaining: Math.max(0, imageWeeklyLimit - used), used, limit: imageWeeklyLimit, planType };
}

async function refundImage(user) {
  const planType = getPlanType(user);
  const { imageWeeklyLimit } = getLimits(planType);

  await syncUsage(user._id, planType);

  const updated = await AiUsageLimit.findOneAndUpdate(
    { userId: user._id, imageUsed: { $gt: 0 } },
    { $inc: { imageUsed: -1 }, $set: { planType } },
    { new: true }
  ).lean();

  const used = Number(updated?.imageUsed || 0);
  return {
    allowed: true,
    remaining: Math.max(0, imageWeeklyLimit - used),
    used,
    limit: imageWeeklyLimit,
    planType
  };
}

async function getUsage(user) {
  const planType = getPlanType(user);
  const limits = getLimits(planType);
  const doc = await syncUsage(user._id, planType);
  const chatUsed = Number(doc?.chatUsed || 0);
  const imageUsed = Number(doc?.imageUsed || 0);

  return {
    planType,
    dateKey: doc?.dateKey || getDateKey(),
    weekKey: doc?.weekKey || getIsoWeekKey(),
    chatUsed,
    imageUsed,
    chatDailyLimit: limits.chatDailyLimit,
    imageWeeklyLimit: limits.imageWeeklyLimit,
    chatRemaining: Math.max(0, limits.chatDailyLimit - chatUsed),
    imageRemaining: Math.max(0, limits.imageWeeklyLimit - imageUsed)
  };
}

function canUseStyle(planType, styleType) {
  const p = String(planType || 'free');
  const s = String(styleType || 'free');
  if (s === 'free') return true;
  if (s === 'premium') return p === 'premium' || p === 'premium_plus';
  if (s === 'premium_plus') return p === 'premium_plus';
  return false;
}

module.exports = {
  getDateKey,
  getIsoWeekKey,
  getPlanType,
  getLimits,
  canUseStyle,
  getUsage,
  consumeChat,
  refundChat,
  consumeImage,
  refundImage
};
