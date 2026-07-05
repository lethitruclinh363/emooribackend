const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../model/Users');
const Profile = require('../model/Profile');
const Theme = require('../model/Theme');
const Mood = require('../model/Checkin');
const Subscription = require('../model/Subscription');
const Payment = require('../model/Payment');

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

const adminData = {
  email: 'giangtuduc.12cxm@gmail.com',
  passwordPlain: '12345678',
  passwordHash:
    '$2b$10$/OnTxYnygpRqnlVse2H0SOyu/Aiu2rJE2xCTMgj6DEHVWJqa5HYBK',
  role: 'admin',
  plan: 'free'
};

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => String(a || '').startsWith(prefix));
  if (!found) return null;
  return String(found).slice(prefix.length);
}

function truthy(v) {
  return String(v || '').toLowerCase() === 'true';
}

function getSeedOptions() {
  const email = getArg('email') || process.env.SEED_ADMIN_EMAIL || adminData.email;
  const passwordPlain =
    getArg('password') || process.env.SEED_ADMIN_PASSWORD_PLAIN || adminData.passwordPlain;
  const passwordHash =
    getArg('hash') || process.env.SEED_ADMIN_PASSWORD_HASH || adminData.passwordHash;
  const role = getArg('role') || process.env.SEED_ADMIN_ROLE || adminData.role;
  const plan = getArg('plan') || process.env.SEED_ADMIN_PLAN || adminData.plan;
  const seedDashboard = process.argv.includes('--seed-dashboard') || truthy(process.env.SEED_DASHBOARD);
  const seedCountRaw = getArg('seed-count') || process.env.SEED_DASHBOARD_COUNT || '5';
  const seedCount = Math.max(0, Math.min(50, Number(seedCountRaw) || 0));
  return { email, passwordPlain, passwordHash, role, plan, seedDashboard, seedCount };
}

async function seedAdmin() {
  try {
    const opts = getSeedOptions();
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully.');

    // Check if user exists
    let user = await User.findOne({ email: opts.email });
    const hashedPassword = opts.passwordHash
      ? String(opts.passwordHash)
      : await bcrypt.hash(String(opts.passwordPlain), 10);

    if (user) {
      console.log('Admin user already exists. Updating role and password...');
      user.password = hashedPassword;
      user.role = String(opts.role || 'admin');
      user.plan = String(opts.plan || 'free');
      await user.save();
    } else {
      console.log('Creating new admin user...');
      user = await User.create({
        email: opts.email,
        password: hashedPassword,
        role: String(opts.role || 'admin'),
        plan: String(opts.plan || 'free')
      });
    }

    // Ensure profile exists
    let profile = await Profile.findOne({ userId: user._id });
    if (!profile) {
      console.log('Creating admin profile...');
      await Profile.create({
        userId: user._id,
        fullName: 'System Admin',
        level: 99,
        xp: 99999,
        streak: 365,
        activeTheme: 'Galaxy'
      });
    } else {
      console.log('Admin profile already exists.');
      profile.fullName = 'System Admin';
      profile.level = 99;
      await profile.save();
    }

    const themesToSeed = [
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
        preview: '�',
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

    let created = 0;
    let updated = 0;
    for (const t of themesToSeed) {
      const existing = await Theme.findOne({ $or: [{ slug: t.slug }, { name: t.name }] });
      if (existing) {
        await Theme.updateOne({ _id: existing._id }, { $set: t });
        updated += 1;
      } else {
        await Theme.create(t);
        created += 1;
      }
    }
    console.log(`Themes seeded: created=${created}, updated=${updated}`);

    console.log('********************************=========********************************');
    console.log('ADMIN ACCOUNT CREATED/UPDATED SUCCESSFULLY');
    console.log(`Email: ${opts.email}`);
    console.log(`Role: ${String(opts.role || 'admin')}`);
    console.log('********************************=========********************************');

    if (opts.seedDashboard && opts.seedCount > 0) {
      const moods = ['happy', 'sad', 'angry', 'anxious', 'neutral'];
      const themes = ['default', 'sang', 'toi', 'galaxy', 'healing-sky'];
      const now = new Date();
      for (let i = 1; i <= opts.seedCount; i += 1) {
        const email = `demo.user+${i}@example.com`;
        const password = await bcrypt.hash('12345678', 10);
        const plan = i % 2 === 0 ? 'premium' : 'free';
        const role = 'user';
        const demoUser = await User.findOneAndUpdate(
          { email },
          {
            $setOnInsert: { email, password, role, plan, isPremium: plan !== 'free', premiumPlan: plan },
            $set: { role, plan, isPremium: plan !== 'free', premiumPlan: plan },
          },
          { upsert: true, new: true }
        );

        await Profile.findOneAndUpdate(
          { userId: demoUser._id },
          {
            $setOnInsert: { userId: demoUser._id },
            $set: { fullName: `Demo User ${i}`, activeTheme: themes[i % themes.length] },
          },
          { upsert: true, new: true }
        );

        await Mood.create({
          userId: demoUser._id,
          mood: moods[i % moods.length],
          intensity: (i % 5) + 1,
          note: 'seed',
          date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        });

        if (plan !== 'free') {
          const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const endDate = new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000);
          await Subscription.findOneAndUpdate(
            { userId: demoUser._id, status: 'active' },
            {
              $setOnInsert: { userId: demoUser._id },
              $set: { plan, startDate, endDate, status: 'active' },
            },
            { upsert: true, new: true }
          );

          await Payment.create({
            userId: demoUser._id,
            amount: 99000,
            method: 'vnpay',
            status: 'success',
            transactionId: `seed_${Date.now()}_${i}`,
            plan,
            durationDays: 30,
          });
        }
      }
      console.log(`Dashboard seed inserted: users=${opts.seedCount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();
