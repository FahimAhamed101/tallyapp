import crypto from 'node:crypto';
import { HttpError } from './api-helpers';

/**
 * Cloudinary uploads — a port of backend/src/lib/cloudinary.js.
 *
 * The API secret never leaves the server: the Android client posts a base64
 * data URI to our own /api/uploads route and we do the signed upload here.
 * Signing is SHA-1 over the alphabetically sorted params (excluding `file`,
 * `api_key` and `signature`) with the secret appended.
 *
 * Env vars are read lazily inside the functions rather than at module scope,
 * because Next.js may evaluate this module before .env.local is applied in
 * some build steps.
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB decoded

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const env = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  folder: process.env.CLOUDINARY_FOLDER || 'tallykhata',
});

export const isConfigured = (): boolean => {
  const { cloudName, apiKey, apiSecret } = env();
  return Boolean(cloudName && apiKey && apiSecret);
};

export { MAX_BYTES };

function sign(params: Record<string, string | number | undefined>): string {
  const { apiSecret } = env();
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/**
 * Accepts `data:image/jpeg;base64,<...>` (what the app sends) or a bare base64
 * string with `mime` supplied separately.
 */
export function decodeDataUri(
  input: unknown,
  mimeHint?: string,
): { buffer: Buffer; mime: string } {
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
    throw new HttpError(400, `ছবির ধরন সমর্থিত নয় (${mime})`);
  }

  const buffer = Buffer.from(base64.replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new HttpError(400, 'ছবি খালি');
  if (buffer.length > MAX_BYTES) {
    throw new HttpError(
      413,
      `ছবিটি অনেক বড় (সর্বোচ্চ ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`,
    );
  }
  return { buffer, mime };
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  mime?: string;
  tags?: string;
}

/**
 * Uploads an image and returns { url, publicId, width, height, bytes, format }.
 * `publicId` is optional; Cloudinary generates one otherwise.
 */
export async function uploadImage(
  dataUri: unknown,
  { folder, publicId, mime, tags }: UploadOptions = {},
): Promise<UploadedImage> {
  const cfg = env();
  if (!isConfigured()) {
    throw new HttpError(503, 'ছবি আপলোড সেবা এখনো চালু হয়নি');
  }

  const resolvedFolder = folder || cfg.folder;
  const { buffer, mime: resolvedMime } = decodeDataUri(dataUri, mime);
  const timestamp = Math.floor(Date.now() / 1000);
  const ext = resolvedMime.split('/')[1].replace('jpeg', 'jpg');

  const params: Record<string, string | number | undefined> = {
    folder: resolvedFolder,
    timestamp,
    ...(publicId ? { public_id: publicId } : {}),
    ...(tags ? { tags } : {}),
  };
  const signature = sign(params);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: resolvedMime }), `upload.${ext}`);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', resolvedFolder);
  if (publicId) form.append('public_id', publicId);
  if (tags) form.append('tags', tags);
  form.append('signature', signature);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    throw new HttpError(502, `Cloudinary-এ পৌঁছানো যায়নি: ${(err as Error).message}`);
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-json body */
  }

  if (!res.ok || !json || !json.secure_url) {
    const detail =
      ((json?.error as { message?: string } | undefined)?.message) || text.slice(0, 200);
    throw new HttpError(502, `ছবি আপলোড ব্যর্থ: ${detail}`);
  }

  return {
    url: json.secure_url as string,
    publicId: json.public_id as string,
    width: json.width as number | undefined,
    height: json.height as number | undefined,
    bytes: json.bytes as number | undefined,
    format: json.format as string | undefined,
  };
}

/** Best-effort delete; never throws, because a missing asset is not fatal. */
export async function destroyImage(publicId: string | null | undefined): Promise<boolean> {
  const cfg = env();
  if (!isConfigured() || !publicId) return false;

  const timestamp = Math.floor(Date.now() / 1000);

  // `invalidate` asks Cloudinary to purge its delivery CDN. The asset is always
  // really deleted either way — the Admin API reports 0 resources immediately —
  // but the CDN keeps serving the cached copy for a short propagation window.
  // Measured on this account with a warm cache:
  //     without invalidate -> 200 at +0/+5/+15s, 404 by +30s
  //     with    invalidate -> 200 at +0/+5s,      404 by +15s
  // So it roughly halves the window in which a photo the user just deleted is
  // still publicly fetchable. Cheap, and the correct thing to ask for.
  const params = { public_id: publicId, timestamp, invalidate: 'true' };
  const signature = sign(params);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('invalidate', 'true');
  form.append('signature', signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`, {
      method: 'POST',
      body: form,
    });
    const json = (await res.json().catch(() => null)) as { result?: string } | null;
    return Boolean(json && (json.result === 'ok' || json.result === 'not found'));
  } catch {
    return false;
  }
}
