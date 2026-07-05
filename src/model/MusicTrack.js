const mongoose = require('mongoose');

const MUSIC_TRACK_CATEGORIES = [
  'piano',
  'sleep',
  'focus',
  'breathing',
  'calm',
  'nature',
  'other',
];

const MusicTrackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: MUSIC_TRACK_CATEGORIES,
      default: 'other',
      index: true,
    },
    moodTags: { type: [String], default: [] },
    audioUrl: { type: String, default: '', trim: true },
    coverUrl: { type: String, default: '', trim: true },
    durationSeconds: { type: Number, default: 0, min: 0 },
    durationLabel: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isPremium: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, index: true },
    playCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = {
  MusicTrack: mongoose.model('MusicTrack', MusicTrackSchema),
  MUSIC_TRACK_CATEGORIES,
};
