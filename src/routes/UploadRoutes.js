const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

const auth = require('../middleware/auth');
const User = require('../model/Users');
const { getPublicBaseUrl } = require('../utils/mediaUrl');

const router = express.Router();
router.use(auth.verifyToken);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function getPremiumStatus(user) {
  const premiumPlan = String(user?.premiumPlan || user?.plan || 'free').toLowerCase();
  return user?.isPremium === true || premiumPlan !== 'free';
}

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || 'emoori').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, folder };
}

async function uploadToCloudinary({ fileBuffer, filename, mimetype }) {
  const cfg = getCloudinaryConfig();
  if (!cfg) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${cfg.folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');

  const form = new FormData();
  form.append('file', fileBuffer, { filename, contentType: mimetype });
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', cfg.folder);
  form.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`;
  const res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 20000 });
  const secureUrl = String(res?.data?.secure_url || '').trim();
  if (!secureUrl) return null;
  return secureUrl;
}

router.post('/image', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isPremium = getPremiumStatus(user);
    if (!isPremium) {
      return res.status(403).json({ message: 'Premium required to upload images' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const original = String(file.originalname || 'image').trim();
    const ext = path.extname(original) || '.jpg';
    const filename = `community_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;

    const cloudUrl = await uploadToCloudinary({
      fileBuffer: file.buffer,
      filename,
      mimetype: file.mimetype || 'image/jpeg',
    }).catch(() => null);

    if (cloudUrl) {
      return res.status(200).json({ imageUrl: cloudUrl });
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
    const outPath = path.join(uploadsRoot, filename);
    await fs.promises.writeFile(outPath, file.buffer);

    const baseUrl = getPublicBaseUrl(req);
    return res.status(200).json({ imageUrl: `${baseUrl}/uploads/${filename}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
