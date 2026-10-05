/**
 * Throwaway Cloudinary connectivity probe.
 *
 *   CLOUD_NAME=... API_KEY=... API_SECRET=... node cloudprobe.js
 *
 * Uploads a 1x1 PNG and prints the resulting URL, or the API's error. Never
 * prints the secret. Delete this file once the credentials are confirmed.
 */
const crypto = require('crypto');

const CLOUD = process.env.CLOUD_NAME;
const KEY = process.env.API_KEY;
const SECRET = process.env.API_SECRET;

const mask = (s) =>
  s ? `${s.slice(0, 3)}${'*'.repeat(Math.max(0, s.length - 6))}${s.slice(-3)}` : '(unset)';

console.log(`cloud_name : ${CLOUD}`);
console.log(`api_key    : ${mask(KEY)}`);
console.log(`api_secret : ${mask(SECRET)}`);
console.log('');

// 1x1 red PNG — smallest valid image, keeps the probe free.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

(async () => {
  const ts = Math.floor(Date.now() / 1000);

  // Cloudinary signs every param except file / api_key / signature:
  // alphabetically sorted "k=v" pairs joined by "&", then the secret appended.
  const params = { folder: 'tallykhata/probe', timestamp: ts };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + SECRET).digest('hex');
  console.log(`string to sign : ${toSign.replace(String(ts), '<ts>')}`);

  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'probe.png');
  form.append('api_key', KEY);
  form.append('timestamp', String(ts));
  form.append('folder', params.folder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const text = await res.text();

  console.log(`HTTP ${res.status}`);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }

  if (json && json.secure_url) {
    console.log('UPLOAD OK');
    console.log(`  public_id  : ${json.public_id}`);
    console.log(`  secure_url : ${json.secure_url}`);
    console.log(`  bytes      : ${json.bytes}  format=${json.format}`);
  } else {
    console.log('UPLOAD FAILED');
    console.log(JSON.stringify(json ? json.error || json : text.slice(0, 500), null, 2));
  }
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
