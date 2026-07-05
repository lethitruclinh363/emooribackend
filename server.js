const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env');
const dotenvResult = dotenv.config({ path: envPath });

const openAiKeyLoaded = String(process.env.OPENAI_API_KEY || '').trim().length > 0;
const openAiChatModel = String(process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini').trim();
const openAiImageModel = String(process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1').trim();
const openAiImageSize = String(process.env.OPENAI_IMAGE_SIZE || '1024x1024').trim();
console.log('[env] dotenv path:', envPath);
console.log('[env] dotenv loaded:', !dotenvResult.error);
console.log('[env] OPENAI key loaded:', openAiKeyLoaded);
console.log('[env] OPENAI chat model:', openAiChatModel);
console.log('[env] OPENAI image model:', openAiImageModel);
console.log('[env] OPENAI image size:', openAiImageSize);
console.log('[env] GOOGLE_WEB_CLIENT_ID loaded:', Boolean(String(process.env.GOOGLE_WEB_CLIENT_ID || '').trim()));

const cors = require('cors');
const connectDB = require('./src/config/db.js');
const mongoose = require('mongoose');

// Import Routes
const usersRoutes = require('./src/routes/usersRoutes.js');
const CheckinRoutes = require('./src/routes/CheckinRoutes.js');
const JournalRoutes = require('./src/routes/JournalRoutes.js');
const CommentRoutes = require('./src/routes/CommentRoutes.js');
const PostRoutes = require('./src/routes/PostRoutes.js');
const CommunityRoutes = require('./src/routes/CommunityRoutes.js');
const ProfileRoutes = require('./src/routes/ProfileRoutes.js');
const ReactionRoutes = require('./src/routes/ReactionRoutes.js');
const RecommendationRoutes = require('./src/routes/RecommendationRoutes.js');
const SubscriptionRoutes = require('./src/routes/SubscriptionRoutes.js');
const PaymentRoutes = require('./src/routes/PaymentRoutes.js');
const StoreRoutes = require('./src/routes/StoreRoutes.js');
const adminRoutes = require('./src/routes/adminRoutes.js');
const aiRoutes = require('./src/routes/AiRoutes.js');
const uploadRoutes = require('./src/routes/UploadRoutes.js');
const musicRoutes = require('./src/routes/MusicRoutes.js');
const Theme = require('./src/model/Theme.js');

// Initialize the application
const app = express();
app.get('/', (req, res) => {
  res.send('EMOORI API is running 🚀');
});

app.get('/api', (req, res) => {
  res.json({
    message: 'EMOORI API is running',
    status: 'OK'
  });
});

// Middlewares
app.use(express.json({ limit: '10mb' })); // Tăng giới hạn để nhận ảnh base64
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        /^https:\/\/.*\.vercel\.app$/i,
        /^http:\/\/localhost(:\d+)?$/i,
        /^https:\/\/localhost(:\d+)?$/i,
        /^https:\/\/emooribackend\.onrender\.com$/i,
      ];

      if (!origin) return callback(null, true);
      if (allowedOrigins.some((pattern) => pattern.test(origin))) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

const uploadsRoot = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
app.use('/uploads', express.static(uploadsRoot));

app.get('/api/health', (req, res) => {
  const dbReady =
    typeof connectDB.getDbReady === 'function'
      ? connectDB.getDbReady()
      : mongoose.connection.readyState === 1;
  const dbName =
    typeof connectDB.getConnectedDbName === 'function'
      ? connectDB.getConnectedDbName()
      : mongoose.connection?.name || null;
  res.status(200).json({
    ok: true,
    dbReady,
    dbName,
    dbError: typeof connectDB.getLastError === 'function' ? connectDB.getLastError() : null
  });
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (req.path === '/api' || req.path === '/api/health') return next();
  const dbReady =
    typeof connectDB.getDbReady === 'function'
      ? connectDB.getDbReady()
      : mongoose.connection.readyState === 1;
  if (dbReady) return next();
  return res.status(503).json({
    message:
      'Database unavailable. Check MONGODB_URI and MongoDB Atlas IP whitelist, then restart the backend.'
  });
});

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function backfillThemeSlugs() {
  const docs = await Theme.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).lean();
  for (const d of docs) {
    const base = slugify(d.name);
    if (!base) continue;
    let candidate = base;
    let i = 1;
    while (await Theme.exists({ slug: candidate, _id: { $ne: d._id } })) {
      candidate = `${base}-${i}`;
      i += 1;
    }
    await Theme.updateOne({ _id: d._id }, { $set: { slug: candidate } });
  }
}

async function seedDefaultThemes() {
  const themes = [
    {
      name: 'Sáng',
      slug: 'sang',
      type: 'free',
      primaryColor: '#6C63FF',
      secondaryColor: '#8E87FF',
      gradient: 'from-indigo-500 to-violet-500',
      preview: '☀️',
      previewColors: ['#6C63FF', '#8E87FF'],
      isActive: true,
    },
    {
      name: 'Tối',
      slug: 'toi',
      type: 'free',
      primaryColor: '#0F172A',
      secondaryColor: '#1E293B',
      gradient: 'from-slate-900 to-slate-700',
      preview: '🌙',
      previewColors: ['#0F172A', '#1E293B'],
      isActive: true,
    },
    {
      name: 'Healing Sky',
      slug: 'healing-sky',
      type: 'premium',
      primaryColor: '#AEE4FF',
      secondaryColor: '#F7D9F0',
      gradient: 'from-sky-200 via-blue-200 to-pink-200',
      preview: '🪽',
      previewColors: ['#AEE4FF', '#D8E9FF', '#F7D9F0'],
      isActive: true,
    },
    {
      name: 'Cotton Candy',
      slug: 'cotton-candy',
      type: 'premium',
      primaryColor: '#FFD1E8',
      secondaryColor: '#CDEBFF',
      gradient: 'from-pink-200 via-violet-200 to-sky-200',
      preview: '🍬',
      previewColors: ['#FFD1E8', '#E7D6FF', '#CDEBFF'],
      isActive: true,
    },
    {
      name: 'Dream Ocean',
      slug: 'dream-ocean',
      type: 'premium',
      primaryColor: '#BFEAFF',
      secondaryColor: '#B9F3E4',
      gradient: 'from-sky-200 via-blue-200 to-emerald-200',
      preview: '🫧',
      previewColors: ['#BFEAFF', '#A7D8FF', '#B9F3E4'],
      isActive: true,
    },
    {
      name: 'Lavender Cloud',
      slug: 'lavender-cloud',
      type: 'premium',
      primaryColor: '#E8D9FF',
      secondaryColor: '#FFE3F2',
      gradient: 'from-violet-200 via-indigo-200 to-pink-200',
      preview: '☁️',
      previewColors: ['#E8D9FF', '#D6E3FF', '#FFE3F2'],
      isActive: true,
    },
    {
      name: 'Sunrise',
      slug: 'sunrise',
      type: 'premium',
      primaryColor: '#FFE0C7',
      secondaryColor: '#D6E6FF',
      gradient: 'from-orange-200 via-pink-200 to-sky-200',
      preview: '🌄',
      previewColors: ['#FFE0C7', '#FFD6E7', '#D6E6FF'],
      isActive: true,
    },
    {
      name: 'Galaxy',
      slug: 'galaxy',
      type: 'premium',
      primaryColor: '#DCCBFF',
      secondaryColor: '#FFE0F7',
      gradient: 'from-violet-200 via-sky-200 to-pink-200',
      preview: '✨',
      previewColors: ['#DCCBFF', '#CBE5FF', '#FFE0F7'],
      isActive: true,
    },
  ].map((t) => ({ ...t, slug: slugify(t.slug || t.name) }));

  for (const t of themes) {
    await Theme.updateOne({ slug: t.slug }, { $setOnInsert: t }, { upsert: true });
  }
}

// API Routes
app.use('/api', usersRoutes);
app.use('/api/journals', JournalRoutes);
app.use('/api/checkin', CheckinRoutes);
app.use('/api/comments', CommentRoutes);
app.use('/api/posts', PostRoutes);
app.use('/api/community', CommunityRoutes);
app.use('/community', CommunityRoutes);
app.use('/api/profile', ProfileRoutes);
app.use('/api/reactions', ReactionRoutes);
app.use('/api/recommendations', RecommendationRoutes);
app.use('/api/subscriptions', SubscriptionRoutes);
app.use('/api/payments', PaymentRoutes);
app.use('/api/store', StoreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/music', musicRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

connectDB().catch(() => {});

function waitForMongo() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  return new Promise((resolve) => {
    mongoose.connection.once('open', resolve);
  });
}

(async () => {
  await waitForMongo();
  await backfillThemeSlugs();
  await seedDefaultThemes();
})().catch((err) => {
  console.error('Post-start tasks failed:', err);
});
