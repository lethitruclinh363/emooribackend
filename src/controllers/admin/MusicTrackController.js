const { MusicTrack, MUSIC_TRACK_CATEGORIES } = require('../../model/MusicTrack');
const {
  uploadAudio,
  uploadImage,
  deleteFile,
  getStorageMode,
  isPublicMediaUrl,
} = require('../../services/storageService');

function toAdminTrack(doc) {
  return {
    id: String(doc._id),
    _id: String(doc._id),
    title: doc.title,
    artist: doc.artist,
    description: doc.description || '',
    category: doc.category,
    moodTags: Array.isArray(doc.moodTags) ? doc.moodTags : [],
    audioUrl: doc.audioUrl || '',
    coverUrl: doc.coverUrl || '',
    durationSeconds: Number(doc.durationSeconds || 0),
    durationLabel: doc.durationLabel || '',
    isActive: doc.isActive === true,
    isPremium: doc.isPremium === true,
    sortOrder: Number(doc.sortOrder || 0),
    playCount: Number(doc.playCount || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMoodTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const raw = String(value || '').trim();
  if (!raw) return [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {}
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCategory(value) {
  const category = String(value || 'other').trim().toLowerCase();
  return MUSIC_TRACK_CATEGORIES.includes(category) ? category : 'other';
}

function sanitizePayload(body) {
  return {
    title: String(body.title || '').trim(),
    artist: String(body.artist || '').trim(),
    description: String(body.description || '').trim(),
    category: normalizeCategory(body.category),
    moodTags: parseMoodTags(body.moodTags),
    audioUrl: String(body.audioUrl || '').trim(),
    coverUrl: String(body.coverUrl || '').trim(),
    durationSeconds: parseNumber(body.durationSeconds, 0),
    durationLabel: String(body.durationLabel || '').trim(),
    isActive: parseBoolean(body.isActive, true),
    isPremium: parseBoolean(body.isPremium, false),
    sortOrder: parseNumber(body.sortOrder, 0),
  };
}

async function replaceFileIfNeeded(req, file, manualUrl, existingUrl, uploader, validator) {
  if (!file) {
    if (manualUrl) {
      return validator && !validator(manualUrl) ? '' : manualUrl;
    }
    return existingUrl || '';
  }

  const uploaded = await uploader(req, file);
  if (existingUrl && existingUrl !== uploaded.url) {
    await deleteFile(existingUrl).catch(() => null);
  }
  return uploaded.url;
}

function ensureActiveTrackHasPlayableAudio(payload, audioUrl) {
  if (payload.isActive && !isPublicMediaUrl(audioUrl)) {
    return 'Bài nhạc active phải có audioUrl public hợp lệ hoặc upload audioFile.';
  }
  return null;
}

exports.getMusicTracks = async (req, res) => {
  try {
    const docs = await MusicTrack.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    const tracks = docs.map(toAdminTrack);

    return res.status(200).json({
      success: true,
      storageMode: getStorageMode(),
      stats: {
        totalTracks: tracks.length,
        activeTracks: tracks.filter((track) => track.isActive).length,
        premiumTracks: tracks.filter((track) => track.isPremium).length,
        totalPlayCount: tracks.reduce((sum, track) => sum + Number(track.playCount || 0), 0),
      },
      tracks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.createMusicTrack = async (req, res) => {
  try {
    const payload = sanitizePayload(req.body || {});
    const audioFile = req.files?.audioFile?.[0];
    const coverFile = req.files?.coverFile?.[0];

    if (!payload.title || !payload.artist) {
      return res.status(400).json({ success: false, error: 'Title and artist are required' });
    }

    if (payload.audioUrl && !isPublicMediaUrl(payload.audioUrl)) {
      return res.status(400).json({
        success: false,
        error: 'audioUrl must be a valid public URL',
      });
    }

    if (payload.coverUrl && !isPublicMediaUrl(payload.coverUrl)) {
      return res.status(400).json({
        success: false,
        error: 'coverUrl must be a valid public URL',
      });
    }

    let audioUrl = payload.audioUrl;
    if (audioFile) {
      const uploadedAudio = await uploadAudio(req, audioFile);
      audioUrl = uploadedAudio.url;
    }

    const activeAudioError = ensureActiveTrackHasPlayableAudio(payload, audioUrl);
    if (activeAudioError) {
      return res.status(400).json({ success: false, error: activeAudioError });
    }

    let coverUrl = payload.coverUrl;
    if (coverFile) {
      const uploadedCover = await uploadImage(req, coverFile);
      coverUrl = uploadedCover?.url || '';
    }

    const track = await MusicTrack.create({
      ...payload,
      audioUrl,
      coverUrl,
    });

    return res.status(201).json({
      success: true,
      track: toAdminTrack(track),
      storageMode: getStorageMode(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateMusicTrack = async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    const payload = sanitizePayload(req.body || {});
    const audioFile = req.files?.audioFile?.[0];
    const coverFile = req.files?.coverFile?.[0];

    if (payload.audioUrl && !isPublicMediaUrl(payload.audioUrl)) {
      return res.status(400).json({
        success: false,
        error: 'audioUrl must be a valid public URL',
      });
    }

    if (payload.coverUrl && !isPublicMediaUrl(payload.coverUrl)) {
      return res.status(400).json({
        success: false,
        error: 'coverUrl must be a valid public URL',
      });
    }

    track.title = payload.title || track.title;
    track.artist = payload.artist || track.artist;
    track.description = payload.description;
    track.category = payload.category;
    track.moodTags = payload.moodTags;
    track.durationSeconds = payload.durationSeconds;
    track.durationLabel = payload.durationLabel;
    track.isPremium = payload.isPremium;
    track.sortOrder = payload.sortOrder;
    track.audioUrl = await replaceFileIfNeeded(
      req,
      audioFile,
      payload.audioUrl,
      track.audioUrl,
      uploadAudio,
      isPublicMediaUrl
    );
    track.coverUrl = await replaceFileIfNeeded(
      req,
      coverFile,
      payload.coverUrl,
      track.coverUrl,
      uploadImage,
      isPublicMediaUrl
    );

    const activeAudioError = ensureActiveTrackHasPlayableAudio(payload, track.audioUrl);
    if (activeAudioError) {
      return res.status(400).json({ success: false, error: activeAudioError });
    }

    track.isActive = payload.isActive;

    await track.save();

    return res.status(200).json({
      success: true,
      track: toAdminTrack(track),
      storageMode: getStorageMode(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteMusicTrack = async (req, res) => {
  try {
    const track = await MusicTrack.findByIdAndDelete(req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    await Promise.allSettled([
      deleteFile(track.audioUrl),
      deleteFile(track.coverUrl),
    ]);

    return res.status(200).json({ success: true, message: 'Track deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.toggleActive = async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    if (!track.isActive && !isPublicMediaUrl(track.audioUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Không thể bật active cho bài nhạc chưa có audioUrl public hợp lệ.',
      });
    }
    track.isActive = !track.isActive;
    await track.save();
    return res.status(200).json({ success: true, track: toAdminTrack(track) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.togglePremium = async (req, res) => {
  try {
    const track = await MusicTrack.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    track.isPremium = !track.isPremium;
    await track.save();
    return res.status(200).json({ success: true, track: toAdminTrack(track) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
