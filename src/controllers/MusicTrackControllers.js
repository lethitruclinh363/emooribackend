const { MusicTrack } = require('../model/MusicTrack');
const { isPublicMediaUrl } = require('../services/storageService');

function isPlayablePublicTrack(doc) {
  return doc?.isActive === true && isPublicMediaUrl(doc?.audioUrl);
}

function toPublicTrack(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    artist: doc.artist,
    description: doc.description || '',
    category: doc.category,
    moodTags: Array.isArray(doc.moodTags) ? doc.moodTags : [],
    audioUrl: doc.audioUrl || '',
    coverUrl: doc.coverUrl || '',
    durationSeconds: Number(doc.durationSeconds || 0),
    durationLabel: doc.durationLabel || '',
    isPremium: doc.isPremium === true,
    sortOrder: Number(doc.sortOrder || 0),
    playCount: Number(doc.playCount || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

exports.getMusicTracks = async (req, res) => {
  try {
    const tracks = await MusicTrack.find({ isActive: true, audioUrl: { $exists: true, $ne: '' } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      tracks: tracks.filter(isPlayablePublicTrack).map(toPublicTrack),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load music tracks',
    });
  }
};

exports.getMusicTrackById = async (req, res) => {
  try {
    const track = await MusicTrack.findOne({
      _id: req.params.id,
      isActive: true,
      audioUrl: { $exists: true, $ne: '' },
    }).lean();

    if (!track || !isPlayablePublicTrack(track)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }

    return res.status(200).json({
      success: true,
      track: toPublicTrack(track),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load track',
    });
  }
};

exports.increaseMusicPlayCount = async (req, res) => {
  try {
    const track = await MusicTrack.findByIdAndUpdate(
      req.params.id,
      { $inc: { playCount: 1 } },
      { new: true }
    ).lean();

    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }

    return res.status(200).json({
      success: true,
      playCount: Number(track.playCount || 0),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to increase play count',
    });
  }
};
