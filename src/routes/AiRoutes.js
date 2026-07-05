const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const AiControllers = require('../controllers/AiControllers');

const router = express.Router();

router.use(auth.verifyToken);

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'ai', 'input');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
    const name = `input_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!ok) return cb(new Error('Chỉ hỗ trợ ảnh JPG/PNG/WEBP'));
    return cb(null, true);
  }
});

function uploadSingleImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    const msg = String(err.message || 'Upload failed');
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: msg });
  });
}

router.get('/usage', AiControllers.getUsage);
router.post('/chat', AiControllers.chat);
router.get('/chat/history', AiControllers.getChatHistory);

router.get('/image/styles', AiControllers.getImageStyles);
router.post('/image/generate', uploadSingleImage, AiControllers.generateImage);
router.get('/image/history', AiControllers.getImageHistory);
router.delete('/image/:id', AiControllers.deleteImage);

module.exports = router;
