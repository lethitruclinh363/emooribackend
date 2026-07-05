const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { MusicTrack } = require('../model/MusicTrack');

const LEGACY_SAMPLE_TITLES = [
  'Moonlit Piano',
  'Sleepy Clouds',
  'Focus Bloom',
  'Breathing Tide',
  'Calm Garden',
  'Forest Mist',
];

const GENTLE_TRACK_DRAFTS = [
  {
    title: 'Haru Haru',
    artist: 'Piano Cover',
    description: 'Một bản piano nhẹ nhàng để bạn thả lỏng cảm xúc.',
    category: 'piano',
    moodTags: ['calm', 'piano', 'relax'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 302,
    durationLabel: '5:02',
    isActive: false,
    isPremium: false,
    sortOrder: 0,
  },
  {
    title: 'Dịu Lại Một Chút',
    artist: 'EMOORI Healing',
    description: 'Dành cho những lúc tâm trí đang quá tải.',
    category: 'calm',
    moodTags: ['calm', 'soft', 'relax'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 360,
    durationLabel: '6:00',
    isActive: false,
    isPremium: false,
    sortOrder: 1,
  },
  {
    title: 'Mưa Nhẹ Bên Cửa Sổ',
    artist: 'EMOORI Healing',
    description: 'Âm thanh mềm giúp bạn thư giãn trước khi ngủ.',
    category: 'sleep',
    moodTags: ['sleep', 'rain', 'night'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 450,
    durationLabel: '7:30',
    isActive: false,
    isPremium: false,
    sortOrder: 2,
  },
  {
    title: 'Thở Cùng Gió',
    artist: 'EMOORI Healing',
    description: 'Giai điệu chậm rãi để bạn hít thở sâu hơn.',
    category: 'breathing',
    moodTags: ['breathing', 'reset', 'slow'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 330,
    durationLabel: '5:30',
    isActive: false,
    isPremium: false,
    sortOrder: 3,
  },
  {
    title: 'Ánh Sáng Nhỏ',
    artist: 'EMOORI Healing',
    description: 'Một bản piano ấm áp cho những ngày hơi mệt.',
    category: 'piano',
    moodTags: ['piano', 'warm', 'gentle'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 380,
    durationLabel: '6:20',
    isActive: false,
    isPremium: true,
    sortOrder: 4,
  },
  {
    title: 'Vườn Yên Tĩnh',
    artist: 'EMOORI Healing',
    description: 'Không gian âm thanh nhẹ như đang ngồi trong khu vườn nhỏ.',
    category: 'nature',
    moodTags: ['nature', 'garden', 'calm'],
    audioUrl: '',
    coverUrl: '',
    durationSeconds: 480,
    durationLabel: '8:00',
    isActive: false,
    isPremium: true,
    sortOrder: 5,
  },
];

async function seedMusicTracks() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully.');

    const hiddenLegacy = await MusicTrack.updateMany(
      { title: { $in: LEGACY_SAMPLE_TITLES }, artist: 'EMOORI Sample' },
      { $set: { isActive: false } }
    );

    let created = 0;
    let updated = 0;

    for (const track of GENTLE_TRACK_DRAFTS) {
      const existing = await MusicTrack.findOne({
        title: track.title,
        artist: track.artist,
      });

      if (existing) {
        await MusicTrack.updateOne(
          { _id: existing._id },
          {
            $set: {
              title: track.title,
              artist: track.artist,
              description: track.description,
              category: track.category,
              moodTags: track.moodTags,
              durationSeconds: track.durationSeconds,
              durationLabel: track.durationLabel,
              isPremium: track.isPremium,
              sortOrder: track.sortOrder,
            },
            $setOnInsert: {
              audioUrl: '',
              coverUrl: '',
              isActive: false,
            },
          }
        );
        updated += 1;
      } else {
        await MusicTrack.create(track);
        created += 1;
      }
    }

    console.log(
      `Legacy AI samples hidden: ${hiddenLegacy.modifiedCount || 0}`
    );
    console.log(`Gentle music drafts seeded: created=${created}, updated=${updated}`);
    console.log('Draft tracks stay inactive until admin uploads real audio.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding music tracks:', error);
    process.exit(1);
  }
}

seedMusicTracks();
