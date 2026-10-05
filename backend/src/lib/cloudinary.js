const crypto = require('crypto');
const { httpError } = require('./http');

/**
 * Cloudinary uploads.
 *
 * The API secret never leaves the server: the Android client posts a base64
 * data URI to our own /api/uploads route and we do the signed upload here.
 * Signing is SHA-1 over the alphabetically sorted params (excluding `file`,
 * `api_key` and `signature`) with the secret appended.
 */
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const FOLDER = process.env.CLOUDINARY_FOLDER || 'tallykhata';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB decoded

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const isConfigured = () => Boolean(CLOUD_NAME && API_KEY && API_SECRET);

function sign(params) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
}

/**
 * Accepts `data:image/jpeg;base64,<...>` (what the app sends) or a bare base64
 * string with `mime` supplied separately.
 */
function decodeDataUri(input, mimeHint) {
  const raw = String(input || '');
  let mime = mimeHint || '';
  let base64 = raw;

  const match = /^data:([^;,]+);base64,(.*)$/s.exec(raw);
  if (match) {
    mime = match[1];
    base64 = match[2];
  }
  if (!mime) mime = 'image/jpeg';

  if (!ALLOWED_MIME.has(mime)) {
    throw httpError(400, `ছবির ধরন সমর্থিত নয় (${mime})`);
  }

  const buffer = Buffer.from(base64.replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw httpError(400, 'ছবি খালি');
  if (buffer.length > MAX_BYTES) {
    throw httpError(413, `ছবিটি অনেক বড় (সর্বোচ্চ ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`);
  }
  return { buffer, mime };
}

/**
 * Uploads an image and returns { url, publicId, width, height, bytes, format }.
 * `publicId` is optional; Cloudinary generates one otherwise.
 */
async function uploadImage(dataUri, { folder = FOLDER, publicId, mime, tags } = {}) {
  if (!isConfigured()) {
    throw httpError(503, 'ছবি আপলোড সেবা এখনো চালু হয়নি');
  }

  const { buffer, mime: resolvedMime } = decodeDataUri(dataUri, mime);
  const timestamp = Math.floor(Date.now() / 1000);
  const ext = resolvedMime.split('/')[1].replace('jpeg', 'jpg');

  const params = {
    folder,
    timestamp,
    ...(publicId ? { public_id: publicId } : {}),
    ...(tags ? { tags } : {}),
  };
  const signature = sign(params);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: resolvedMime }), `upload.${ext}`);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  if (publicId) form.append('public_id', publicId);
  if (tags) form.append('tags', tags);
  form.append('signature', signature);

  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    throw httpError(502, `Cloudinary-এ পৌঁছানো যায়নি: ${err.message}`);
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }

  if (!res.ok || !json || !json.secure_url) {
    const detail = (json && json.error && json.error.message) || text.slice(0, 200);
    throw httpError(502, `ছবি আপলোড ব্যর্থ: ${detail}`);
  }

  return {
    url: json.secure_url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
    bytes: json.bytes,
    format: json.format,
  };
}

/** Best-effort delete; never throws, because a missing asset is not fatal. */
async function destroyImage(publicId) {
  if (!isConfigured() || !publicId) return false;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const signature = sign(params);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      body: form,
    });
    const json = await res.json().catch(() => null);
    return Boolean(json && (json.result === 'ok' || json.result === 'not found'));
  } catch {
    return false;
  }
}

module.exports = { uploadImage, destroyImage, isConfigured, decodeDataUri, MAX_BYTES };
