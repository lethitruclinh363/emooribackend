const fs = require('fs');
const path = require('path');

const User = require('../model/Users');
const AiChatMessage = require('../model/AiChatMessage');
const AiUsageLimit = require('../model/AiUsageLimit');
const AiImageGeneration = require('../model/AiImageGeneration');
const AiStyle = require('../model/AiStyle');

const aiChatService = require('../services/ai/aiChatService');
const aiImageService = require('../services/ai/aiImageService');
const aiUsageService = require('../services/ai/aiUsageService');
const aiSafetyService = require('../services/ai/aiSafetyService');
const aiPromptService = require('../services/ai/aiPromptService');

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

async function getUserOr401(req, res) {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const user = await User.findById(userId).lean();
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

exports.getUsage = async (req, res) => {
  try {
    const user = await getUserOr401(req, res);
    if (!user) return;
    const usage = await aiUsageService.getUsage(user);
    return res.status(200).json(usage);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.chat = async (req, res) => {
  let user = null;
  let usage = null;
  let usageConsumed = false;
  try {
    user = await getUserOr401(req, res);
    if (!user) return;

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, error: 'Thiếu message' });
    }

    usage = await aiUsageService.consumeChat(user);
    if (!usage.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Bạn đã dùng hết lượt trò chuyện AI hôm nay.',
        remainingUsage: 0,
        planType: usage.planType
      });
    }
    usageConsumed = true;

    await AiChatMessage.create({
      userId: user._id,
      role: 'user',
      message
    });

    const isRisk = aiSafetyService.detectSelfHarmRisk(message);
    if (isRisk) {
      const reply = aiSafetyService.getSafeCrisisReply();
      await AiChatMessage.create({
        userId: user._id,
        role: 'assistant',
        message: reply,
        detectedEmotion: 'other',
        emotionScore: 50,
        suggestions: [],
        recommendedActions: ['talk_to_friend']
      });

      return res.status(200).json({
        success: true,
        reply,
        detectedEmotion: 'other',
        emotionScore: 50,
        suggestions: [],
        recommendedActions: ['talk_to_friend'],
        remainingUsage: usage.remaining
      });
    }

    const recent = await AiChatMessage.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(16)
      .lean();

    const context = (recent || [])
      .reverse()
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.message || '')
      }));

    const result = await aiChatService.chat({
      systemPrompt: aiPromptService.getChatSystemPrompt(),
      messages: context
    });

    await AiChatMessage.create({
      userId: user._id,
      role: 'assistant',
      message: result.reply,
      detectedEmotion: result.detectedEmotion,
      emotionScore: result.emotionScore,
      suggestions: result.suggestions,
      recommendedActions: result.recommendedActions
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      detectedEmotion: result.detectedEmotion,
      emotionScore: result.emotionScore,
      suggestions: result.suggestions,
      recommendedActions: result.recommendedActions,
      remainingUsage: usage.remaining
    });
  } catch (error) {
    if (usageConsumed && user) {
      try {
        usage = await aiUsageService.refundChat(user);
      } catch (refundError) {
        console.error(
          '[ai.chat] Failed to refund usage:',
          JSON.stringify(
            {
              userId: String(user?._id || ''),
              message: String(refundError?.message || '')
            },
            null,
            2
          )
        );
      }
    }
    const status = Number(error?.statusCode || 500);
    console.error(
      '[ai.chat] Controller error:',
      JSON.stringify(
        {
          status,
          code: error?.code || null,
          message: String(error?.message || 'AI chat failed'),
          providerStatus: error?.providerStatus || null,
          providerType: error?.providerType || null
        },
        null,
        2
      )
    );
    return res.status(status).json({
      success: false,
      error: error.message || 'AI chat failed',
      code: error?.code || null,
      providerStatus: error?.providerStatus || null,
      providerType: error?.providerType || null,
      remainingUsage: usage?.remaining
    });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const user = await getUserOr401(req, res);
    if (!user) return;

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
    const items = await AiChatMessage.find({ userId: user._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ messages: items || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

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

exports.getImageStyles = async (req, res) => {
  try {
    const user = await getUserOr401(req, res);
    if (!user) return;

    await ensureDefaultStyles();

    const styles = await AiStyle.find({ isActive: true }).sort({ type: 1, createdAt: 1 }).lean();
    const planType = aiUsageService.getPlanType(user);
    const formatted = (styles || []).map((s) => ({
      _id: s._id,
      name: s.name,
      description: s.description,
      previewImage: s.previewImage,
      type: s.type,
      isActive: s.isActive,
      canUse: aiUsageService.canUseStyle(planType, s.type)
    }));

    return res.status(200).json({ styles: formatted });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.generateImage = async (req, res) => {
  const filePath = req.file?.path;
  let genId = null;
  let user = null;
  let usage = null;
  let imageUsageConsumed = false;
  try {
    user = await getUserOr401(req, res);
    if (!user) {
      safeUnlink(filePath);
      return;
    }

    const styleId = String(req.body?.style || '').trim();
    if (!styleId) {
      safeUnlink(filePath);
      return res.status(400).json({ error: 'Thiếu style' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Thiếu image' });
    }

    const style = await AiStyle.findById(styleId).lean();
    if (!style || !style.isActive) {
      safeUnlink(filePath);
      return res.status(404).json({ error: 'Style không tồn tại' });
    }

    const planType = aiUsageService.getPlanType(user);
    if (!aiUsageService.canUseStyle(planType, style.type)) {
      safeUnlink(filePath);
      return res.status(403).json({ error: 'Style này dành cho gói cao hơn.' });
    }

    usage = await aiUsageService.consumeImage(user);
    if (!usage.allowed) {
      safeUnlink(filePath);
      return res.status(429).json({
        error: 'Bạn đã dùng hết lượt tạo ảnh trong tuần.',
        remainingUsage: 0,
        planType: usage.planType
      });
    }
    imageUsageConsumed = true;

    const baseUrl = getBaseUrl(req);
    const originalImageUrl = '';

    const gen = await AiImageGeneration.create({
      userId: user._id,
      originalImageUrl,
      generatedImageUrl: '',
      style: style.name,
      styleId: style._id,
      prompt: aiPromptService.getImagePrompt(style),
      status: 'processing',
      isPremiumStyle: style.type !== 'free'
    });
    genId = gen?._id;

    const outputDir = path.join(process.cwd(), 'uploads', 'ai', 'generated');
    const result = await aiImageService.editImage({
      inputFilePath: filePath,
      prompt: aiPromptService.getImagePrompt(style),
      outputDir
    });

    safeUnlink(filePath);

    const fileName = path.basename(result.localFilePath);
    const generatedImageUrl = `${baseUrl}/uploads/ai/generated/${encodeURIComponent(fileName)}`;

    const updated = await AiImageGeneration.findByIdAndUpdate(
      gen._id,
      { generatedImageUrl, status: 'completed' },
      { new: true }
    ).lean();

    return res.status(200).json({
      generation: updated,
      remainingUsage: usage.remaining
    });
  } catch (error) {
    safeUnlink(filePath);
    if (imageUsageConsumed && user) {
      try {
        usage = await aiUsageService.refundImage(user);
      } catch (refundError) {
        console.error(
          '[ai.image] Failed to refund usage:',
          JSON.stringify(
            {
              userId: String(user?._id || ''),
              message: String(refundError?.message || '')
            },
            null,
            2
          )
        );
      }
    }
    if (genId) {
      await AiImageGeneration.findByIdAndUpdate(genId, {
        status: 'failed',
        errorMessage: String(error.message || '')
      });
    }
    const status = Number(error?.statusCode || 500);
    console.error(
      '[ai.image] Controller error:',
      JSON.stringify(
        {
          status,
          code: error?.code || null,
          message: String(error?.message || 'AI image failed'),
          providerStatus: error?.providerStatus || null,
          providerType: error?.providerType || null
        },
        null,
        2
      )
    );
    return res.status(status).json({
      error: error.message || 'AI image failed',
      code: error?.code || null,
      providerStatus: error?.providerStatus || null,
      providerType: error?.providerType || null,
      remainingUsage: usage?.remaining
    });
  }
};

exports.getImageHistory = async (req, res) => {
  try {
    const user = await getUserOr401(req, res);
    if (!user) return;

    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 30)));
    const items = await AiImageGeneration.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ items: items || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteImage = async (req, res) => {
  try {
    const user = await getUserOr401(req, res);
    if (!user) return;

    const { id } = req.params;
    const item = await AiImageGeneration.findOne({ _id: id, userId: user._id }).lean();
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh' });
    }

    const url = String(item.generatedImageUrl || '');
    const parsed = url.split('/uploads/ai/generated/')[1];
    if (parsed) {
      const fileName = decodeURIComponent(parsed.split('?')[0]);
      const localPath = path.join(process.cwd(), 'uploads', 'ai', 'generated', fileName);
      safeUnlink(localPath);
    }

    await AiImageGeneration.deleteOne({ _id: id, userId: user._id });
    return res.status(200).json({ message: 'Đã xóa ảnh' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports._internal = {
  ensureDefaultStyles,
  getBaseUrl
};
