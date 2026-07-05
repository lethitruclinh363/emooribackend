const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || 'emoori').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, folder };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getBaseUrl(req) {
  const origin = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (origin) return origin.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function isPublicMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^[a-z]:\\/i.test(raw)) return false;
  if (raw.startsWith('/')) return false;

  try {
    const url = new URL(raw);
    const hostname = String(url.hostname || '').trim().toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (!hostname) return false;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeExt(originalName, fallbackExt) {
  const ext = String(path.extname(originalName || '') || fallbackExt).trim();
  return ext.startsWith('.') ? ext : `.${ext}`;
}

async function uploadToCloudinary({ fileBuffer, filename, mimetype, folderSuffix, resourceType }) {
  const cfg = getCloudinaryConfig();
  if (!cfg) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${cfg.folder}/${folderSuffix}`;
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');

  const form = new FormData();
  form.append('file', fileBuffer, { filename, contentType: mimetype });
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/upload`;
  const res = await axios.post(endpoint, form, {
    headers: form.getHeaders(),
    timeout: 45000,
  });

  const secureUrl = String(res?.data?.secure_url || '').trim();
  const publicId = String(res?.data?.public_id || '').trim();
  if (!secureUrl) return null;

  return {
    url: secureUrl,
    publicId,
    provider: 'cloudinary',
    resourceType,
  };
}

async function uploadToLocal({ req, fileBuffer, originalName, folderName, fallbackExt }) {
  const ext = normalizeExt(originalName, fallbackExt);
  const filename = `${folderName}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const root = path.join(process.cwd(), 'uploads', folderName);
  ensureDir(root);
  const outPath = path.join(root, filename);
  await fs.promises.writeFile(outPath, fileBuffer);
  return {
    url: `${getBaseUrl(req)}/uploads/${folderName}/${filename}`,
    provider: 'local',
    localPath: outPath,
  };
}

function parseCloudinaryUrl(fileUrl) {
  const cfg = getCloudinaryConfig();
  if (!cfg) return null;
  const url = String(fileUrl || '').trim();
  if (!url.includes(`res.cloudinary.com/${cfg.cloudName}/`)) return null;

  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const resourceTypeMatch = url.match(/\/(image|video|raw)\/upload\//);
  const resourceType = resourceTypeMatch?.[1];
  const tail = url.slice(idx + marker.length).split('?')[0];
  const segments = tail.split('/').filter(Boolean);
  if (!segments.length || !resourceType) return null;

  if (/^v\d+$/.test(segments[0])) {
    segments.shift();
  }

  const last = segments.pop();
  if (!last) return null;
  const withoutExt = last.replace(/\.[^.]+$/, '');
  return {
    resourceType,
    publicId: [...segments, withoutExt].join('/'),
  };
}

async function deleteFromCloudinary(fileUrl) {
  const cfg = getCloudinaryConfig();
  const parsed = parseCloudinaryUrl(fileUrl);
  if (!cfg || !parsed?.publicId || !parsed.resourceType) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${parsed.publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + cfg.apiSecret).digest('hex');

  const form = new FormData();
  form.append('public_id', parsed.publicId);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${parsed.resourceType}/destroy`;
  await axios.post(endpoint, form, { headers: form.getHeaders(), timeout: 20000 }).catch(() => null);
  return true;
}

async function deleteFromLocal(fileUrl) {
  const url = String(fileUrl || '').trim();
  const marker = '/uploads/';
  const idx = url.indexOf(marker);
  if (idx === -1) return false;
  const relativePath = url.slice(idx + marker.length).replace(/\//g, path.sep);
  const absolutePath = path.join(process.cwd(), 'uploads', relativePath);
  if (!fs.existsSync(absolutePath)) return false;
  await fs.promises.unlink(absolutePath).catch(() => null);
  return true;
}

async function uploadAudio(req, file) {
  if (!file?.buffer) throw new Error('Audio file is required');

  const originalName = String(file.originalname || 'audio.mp3').trim();
  const cloud = await uploadToCloudinary({
    fileBuffer: file.buffer,
    filename: originalName,
    mimetype: file.mimetype || 'audio/mpeg',
    folderSuffix: 'music/audio',
    resourceType: 'video',
  }).catch(() => null);

  if (cloud?.url) {
    return { url: cloud.url, storage: 'cloud' };
  }

  const local = await uploadToLocal({
    req,
    fileBuffer: file.buffer,
    originalName,
    folderName: 'music',
    fallbackExt: '.mp3',
  });

  return { url: local.url, storage: 'local' };
}

async function uploadImage(req, file) {
  if (!file?.buffer) throw new Error('Image file is required');

  const originalName = String(file.originalname || 'cover.jpg').trim();
  const cloud = await uploadToCloudinary({
    fileBuffer: file.buffer,
    filename: originalName,
    mimetype: file.mimetype || 'image/jpeg',
    folderSuffix: 'music/covers',
    resourceType: 'image',
  }).catch(() => null);

  if (cloud?.url) {
    return { url: cloud.url, storage: 'cloud' };
  }

  const local = await uploadToLocal({
    req,
    fileBuffer: file.buffer,
    originalName,
    folderName: 'music-covers',
    fallbackExt: '.jpg',
  });

  return { url: local.url, storage: 'local' };
}

async function deleteFile(fileUrl) {
  if (!fileUrl) return false;
  const deletedCloud = await deleteFromCloudinary(fileUrl);
  if (deletedCloud) return true;
  return deleteFromLocal(fileUrl);
}

function getStorageMode() {
  return getCloudinaryConfig() ? 'cloud' : 'local';
}

module.exports = {
  uploadAudio,
  uploadImage,
  deleteFile,
  getStorageMode,
  isPublicMediaUrl,
};
