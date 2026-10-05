import './env';
import zlib from 'node:zlib';

/**
 * Real Cloudinary round-trip for the customer/supplier avatar feature.
 *
 *   npm run upload-check        (server must already be up on :4000)
 *
 * `npm run smoke` only asserts that /api/uploads/status reports
 * `configured: true` — it never touches Cloudinary, because a smoke run should
 * stay fast and offline-safe. That leaves the actual upload path unproven, so
 * this script exercises it end to end:
 *
 *   1. upload a generated PNG as a data URI (what the Android app posts)
 *   2. fetch the returned URL back from Cloudinary and compare the bytes
 *   3. attach it to a new customer and read the row back
 *   4. re-upload and PATCH the customer (the "edit" path)
 *   5. prove the owner guard rejects someone else's public_id
 *   6. delete the asset and confirm Cloudinary really drops it
 *
 * Everything it creates is deleted again, including the Cloudinary assets.
 * Exits non-zero on any failure so it can gate a release.
 */

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4000';
const PHONE = process.env.SMOKE_PHONE || '+8801706617723';
const PASSWORD = process.env.SMOKE_PASSWORD || '123456';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string | null; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: any; text: string }> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers || {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, json, text };
}

/** Minimal deterministic PNG so the bytes are reproducible. */
function makePng(size = 64): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y += 1) {
    raw[p++] = 0; // filter byte
    for (let x = 0; x < size; x += 1) {
      raw[p++] = (x * 4) % 256;
      raw[p++] = (y * 4) % 256;
      raw[p++] = 128;
    }
  }

  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Fallback CRC-32 for Node builds without zlib.crc32. */
let CRC_TABLE: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * How many assets with this public_id still exist, per Cloudinary's Admin API.
 * This is the source of truth: it reads the account, not the CDN cache.
 */
async function adminCount(publicId: string): Promise<number> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || '';
  const key = process.env.CLOUDINARY_API_KEY || '';
  const secret = process.env.CLOUDINARY_API_SECRET || '';
  if (!cloud || !key || !secret) return -1;

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  const json: any = await res.json().catch(() => null);
  return Array.isArray(json?.resources) ? json.resources.length : -1;
}

/**
 * Polls a delivery URL until it 404s. The CDN may serve a cached copy for a
 * short while after a destroy, so an instant check would be flaky.
 */
async function waitForGone(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`);
    if (res.status === 404) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  console.log(`Upload round-trip against ${BASE}\n`);

  // ---- auth -------------------------------------------------------------
  const login = await req('POST', '/api/auth/login', {
    body: { phone: PHONE, password: PASSWORD },
  });
  if (login.status !== 200 || !login.json?.token) {
    console.error(`Cannot sign in as ${PHONE}: ${login.status} ${login.text.slice(0, 200)}`);
    process.exit(1);
  }
  const token: string = login.json.token;
  console.log('Auth');
  check('signed in', login.status === 200);

  const status = await req('GET', '/api/uploads/status', { token });
  check('uploads/status -> 200', status.status === 200);
  check('Cloudinary is configured', status.json?.configured === true);

  const png = makePng();
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  console.log(`\nGenerated PNG: ${png.length} bytes\n`);

  // ---- 1. upload --------------------------------------------------------
  console.log('Upload');
  const up1 = await req('POST', '/api/uploads', {
    token,
    body: { data: dataUri, mime: 'image/png', folder: 'customers' },
  });
  check('POST /api/uploads -> 201', up1.status === 201, `got ${up1.status} ${up1.text.slice(0, 160)}`);
  check('response carries a secure url', typeof up1.json?.url === 'string' && up1.json.url.startsWith('https://'));
  check('response carries a publicId', typeof up1.json?.publicId === 'string' && up1.json.publicId.length > 0);
  check('width/height reported', up1.json?.width === 64 && up1.json?.height === 64,
    `got ${up1.json?.width}x${up1.json?.height}`);
  check('publicId is namespaced to the owner', String(up1.json?.publicId || '').includes('_'));

  const url1: string = up1.json?.url || '';
  const pid1: string = up1.json?.publicId || '';

  // ---- 2. the asset really exists at Cloudinary -------------------------
  console.log('\nAsset is live at Cloudinary');
  if (url1) {
    const fetched = await fetch(url1);
    const bytes = Buffer.from(await fetched.arrayBuffer());
    check('GET the returned url -> 200', fetched.status === 200, `got ${fetched.status}`);
    check('bytes match what we uploaded', bytes.equals(png), `${bytes.length} vs ${png.length}`);
  } else {
    check('GET the returned url -> 200', false, 'no url to fetch');
  }

  // ---- 3. attach to a customer (the "create" path) ----------------------
  console.log('\nAttach on create');
  const created = await req('POST', '/api/customers', {
    token,
    body: { name: 'ছবি টেস্ট', type: 'customer', photoUrl: url1, photoPublicId: pid1 },
  });
  const cid: string = created.json?.customer?.id || '';
  check('customer created -> 201', created.status === 201, `got ${created.status} ${created.text.slice(0, 160)}`);
  check('photoUrl stored on the customer', created.json?.customer?.photoUrl === url1,
    `got ${created.json?.customer?.photoUrl}`);

  const readBack = await req('GET', `/api/customers/${cid}`, { token });
  check('photoUrl survives a re-read', readBack.json?.customer?.photoUrl === url1,
    `got ${readBack.json?.customer?.photoUrl}`);
  check('photoUrl is a Cloudinary URL',
    String(readBack.json?.customer?.photoUrl || '').startsWith('https://res.cloudinary.com'),
    `got ${readBack.json?.customer?.photoUrl}`);
  check('initials still derived (avatar fallback intact)',
    typeof readBack.json?.customer?.initials === 'string' && readBack.json.customer.initials.length > 0);

  // ---- 4. replace the photo (the "edit" path) ---------------------------
  console.log('\nReplace on edit');
  const up2 = await req('POST', '/api/uploads', {
    token,
    body: { data: dataUri, mime: 'image/png', folder: 'customers' },
  });
  check('second upload -> 201', up2.status === 201, `got ${up2.status}`);
  const url2: string = up2.json?.url || '';
  const pid2: string = up2.json?.publicId || '';
  check('second upload has a different publicId', pid2 !== pid1 && pid2.length > 0);

  const patched = await req('POST', `/api/customers/${cid}`, {
    token,
    headers: { 'X-HTTP-Method-Override': 'PATCH' },
    body: { photoUrl: url2, photoPublicId: pid2 },
  });
  check('PATCH via override -> 200', patched.status === 200, `got ${patched.status} ${patched.text.slice(0, 160)}`);
  check('photoUrl replaced', patched.json?.customer?.photoUrl === url2,
    `got ${patched.json?.customer?.photoUrl}`);

  // ---- 5. owner guard ---------------------------------------------------
  console.log('\nOwner guard');
  const noId = await req('POST', '/api/uploads', {
    token,
    headers: { 'X-HTTP-Method-Override': 'DELETE' },
    body: {},
  });
  check('override DELETE with no publicId -> 400', noId.status === 400, `got ${noId.status}`);

  const notMine = await req('DELETE', '/api/uploads?publicId=someoneelse_abc123', { token });
  check("deleting another owner's asset -> 400", notMine.status === 400, `got ${notMine.status}`);

  // ---- 6. delete the assets --------------------------------------------
  //
  // Cloudinary's delivery CDN caches by URL, so right after a destroy the old
  // URL can still answer 200 for a short propagation window even though the
  // asset is already gone from the account. Two independent checks:
  //   · the Admin API, which is the source of truth for "does it still exist"
  //   · a poll of the delivery URL, which must go 404 within a bounded time
  // Asserting on the delivery URL *immediately* would be a flaky test, not a
  // bug report.
  console.log('\nCleanup the assets');

  const del1 = await req('DELETE', `/api/uploads?publicId=${encodeURIComponent(pid1)}`, { token });
  check('DELETE the first asset -> 200', del1.status === 200, `got ${del1.status}`);
  check('destroy reported ok', del1.json?.removed === true, `got ${JSON.stringify(del1.json)}`);
  check('first asset is gone from the account (Admin API)',
    (await adminCount(pid1)) === 0, `Admin API still reports it`);

  if (url1) {
    const gone = await waitForGone(url1, 45_000);
    check('first asset stops being served by the CDN (404 within 45s)', gone, 'still 200 after 45s');
  }

  const del2 = await req('DELETE', `/api/uploads?publicId=${encodeURIComponent(pid2)}`, { token });
  check('DELETE the second asset -> 200', del2.status === 200, `got ${del2.status}`);
  check('second asset is gone from the account (Admin API)',
    (await adminCount(pid2)) === 0, `Admin API still reports it`);

  if (url2) {
    const gone2 = await waitForGone(url2, 45_000);
    check('second asset stops being served by the CDN (404 within 45s)', gone2, 'still 200 after 45s');
  }

  // ---- cleanup the customer --------------------------------------------
  const delC = await req('DELETE', `/api/customers/${cid}`, { token });
  check('test customer removed -> 200', delC.status === 200, `got ${delC.status}`);

  console.log('\n' + '\u2500'.repeat(52));
  console.log(`  passed: ${pass}`);
  console.log(`  failed: ${fail}`);
  console.log('\u2500'.repeat(52) + '\n');

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('upload-check crashed:', err);
  process.exit(1);
});
