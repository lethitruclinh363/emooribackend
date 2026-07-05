function getPublicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const protocol = String(req?.protocol || 'https').trim() || 'https';
  const host = String(req?.get?.('host') || req?.headers?.host || '').trim();
  if (!host) return '';

  const finalProtocol = host.includes('onrender.com') ? 'https' : protocol;
  return `${finalProtocol}://${host}`.replace(/\/+$/, '');
}

function normalizePublicMediaUrl(value, req) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) {
    return raw;
  }

  const publicBaseUrl = getPublicBaseUrl(req);

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname.includes('onrender.com')) {
        url.protocol = 'https:';
      }
      return url.toString();
    } catch {
      return raw;
    }
  }

  const normalizedPath = raw
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .trim();

  if (!publicBaseUrl) return normalizedPath;

  if (normalizedPath.startsWith('uploads/')) {
    return `${publicBaseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return `${publicBaseUrl}${normalizedPath}`;
  }

  if (/^community_[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(normalizedPath)) {
    return `${publicBaseUrl}/uploads/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/')) {
    return `${publicBaseUrl}${normalizedPath}`;
  }

  return `${publicBaseUrl}/${normalizedPath}`;
}

module.exports = {
  getPublicBaseUrl,
  normalizePublicMediaUrl,
};
