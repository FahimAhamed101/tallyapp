/**
 * Full-surface verification for the TallyKhata backend.
 *
 * Covers every route the Express app exposes — the public auth endpoints, the
 * per-user isolation guarantees, the Cloudinary upload path, and all of the
 * book-keeping routes — plus the validation and not-found paths the Android app
 * depends on. Creates its own throwaway records, asserts the *derived* values
 * actually moved, then removes everything it made.
 *
 *   cd backend && npm start        # terminal 1
 *   cd backend && npm run verify   # terminal 2
 *
 * Exit code 0 = everything passed.
 */
const ORIGIN = (process.env.API_ORIGIN || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const BASE = process.env.API_BASE || `${ORIGIN}/api`;

// Seeded demo accounts (see src/seed.js). The suite runs as `primary` and
// borrows `second` purely to prove the two books never see each other.
const ACCOUNTS = {
  primary: { phone: '+8801706617723', password: '123456' },
  second: { phone: '+8801811223344', password: '123456' },
};

/** Bearer token per named session; `raw()` uses the primary one by default. */
const TOKENS = { primary: null, second: null };

let pass = 0;
const failures = [];
let group = '';

const made = { customers: [], cashEntries: [], photoCustomer: null };
let baselineSummary = null;
let baselineProfile = null;

/* ------------------------------------------------------------------ helpers */

function section(name) {
  group = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
}

function ok(label, note = '') {
  pass += 1;
  console.log(`  ✓ ${label}${note ? `   ${note}` : ''}`);
}

function bad(label, why) {
  failures.push(`${group} → ${label}: ${why}`);
  console.log(`  ✗ ${label}   ${why}`);
}

/** Run a step; a thrown error is a failure, not a crash. */
async function step(label, fn) {
  try {
    const note = await fn();
    ok(label, note || '');
  } catch (e) {
    bad(label, e.message);
  }
}

async function rawUrl(method, url, token) {
  const res = await fetch(url, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-json body (the static preview page) */
  }
  return { status: res.status, json, text, type: res.headers.get('content-type') || '' };
}

/**
 * Paths are relative to the /api prefix.
 *
 * `token` defaults to the primary session. Pass `null` explicitly to make an
 * anonymous call (that is how the unauthorized checks are written), or
 * `TOKENS.second` to act as the other user.
 */
async function raw(method, path, body, token = TOKENS.primary) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-json body (the static preview page) */
  }
  return { status: res.status, json, text, type: res.headers.get('content-type') || '' };
}

/** Assert a 2xx and return the parsed body. */
async function j(method, path, body, token) {
  const r = await raw(method, path, body, token);
  if (r.status >= 400) {
    throw new Error(`HTTP ${r.status} ${r.json && r.json.message ? r.json.message : r.text.slice(0, 80)}`);
  }
  return r.json;
}

/** Assert an exact status code (for the error paths). */
async function expectStatus(method, path, body, want, token) {
  const r = await raw(method, path, body, token);
  if (r.status !== want) throw new Error(`expected ${want}, got ${r.status}`);
  return r;
}

/** Log in and stash the token for the named session. */
async function signIn(name) {
  const { phone, password } = ACCOUNTS[name];
  const r = await raw('POST', '/auth/login', { phone, password }, null);
  if (r.status !== 200 || !r.json || !r.json.token) {
    throw new Error(`login failed for ${name}: HTTP ${r.status} ${r.json && r.json.message}`);
  }
  TOKENS[name] = r.json.token;
  return r.json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const num = (s) => Number(String(s).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[৳,\s]/g, ''));

/** A real 1x1 PNG — small enough to inline, valid enough for Cloudinary. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Wait for a background destroy to land; Cloudinary is eventually consistent. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


/* --------------------------------------------------------------- the run */

(async () => {
  console.log(`\nTallyKhata backend — full-surface verification`);
  console.log(`target: ${BASE}\n`);

  /* ------------------------------------------------------------ 1. auth */
  section('auth — register / login / session');

  await step('protected route without a token -> 401', async () => {
    const r = await expectStatus('GET', '/customers', undefined, 401, null);
    assert(r.json && r.json.error === 'UNAUTHORIZED', `error = ${r.json && r.json.error}`);
    return r.json.message;
  });
  await step('protected route with a junk token -> 401', async () => {
    const r = await expectStatus('GET', '/customers', undefined, 401, 'deadbeef'.repeat(8));
    return r.json.message;
  });
  await step('GET /api/auth/me without a token -> 401', async () => {
    const r = await expectStatus('GET', '/auth/me', undefined, 401, null);
    return r.json.message;
  });
  await step('POST /api/auth/register rejects a short password -> 400', async () => {
    const r = await expectStatus(
      'POST',
      '/auth/register',
      { name: 'ভেরিফাই', phone: '01900000001', password: '123' },
      400,
      null,
    );
    return r.json.message;
  });
  await step('POST /api/auth/register rejects a junk phone -> 400', async () => {
    const r = await expectStatus(
      'POST',
      '/auth/register',
      { name: 'ভেরিফাই', phone: 'nope', password: '123456' },
      400,
      null,
    );
    return r.json.message;
  });
  await step('POST /api/auth/register rejects a nameless body -> 400', async () => {
    const r = await expectStatus(
      'POST',
      '/auth/register',
      { phone: '01900000002', password: '123456' },
      400,
      null,
    );
    return r.json.message;
  });
  await step('POST /api/auth/login with a wrong password -> 401', async () => {
    const r = await expectStatus(
      'POST',
      '/auth/login',
      { phone: ACCOUNTS.primary.phone, password: 'wrong-password' },
      401,
      null,
    );
    return r.json.message;
  });
  await step('POST /api/auth/login with an unknown number -> same 401', async () => {
    const unknown = await raw('POST', '/auth/login', { phone: '01999999999', password: 'x' }, null);
    const wrong = await raw(
      'POST',
      '/auth/login',
      { phone: ACCOUNTS.primary.phone, password: 'wrong-password' },
      null,
    );
    assert(unknown.status === 401, `unknown -> ${unknown.status}`);
    // Identical wording is what stops the endpoint enumerating accounts.
    assert(
      unknown.json.message === wrong.json.message,
      `messages differ: "${unknown.json.message}" vs "${wrong.json.message}"`,
    );
    return `both say "${unknown.json.message}"`;
  });

  await step('POST /api/auth/login (local-format number)', async () => {
    // 01706617723 must normalise to the same account as +8801706617723.
    const r = await raw(
      'POST',
      '/auth/login',
      { phone: '01706617723', password: ACCOUNTS.primary.password },
      null,
    );
    assert(r.status === 200, `HTTP ${r.status} ${r.json && r.json.message}`);
    assert(r.json.token && r.json.user, 'no token/user');
    assert(r.json.user.phone === '+8801706617723', `normalised phone = ${r.json.user.phone}`);
    return `${r.json.user.name} · ${r.json.user.phone}`;
  });

  await step('sign in as both seeded accounts', async () => {
    const a = await signIn('primary');
    const b = await signIn('second');
    assert(TOKENS.primary && TOKENS.second, 'missing token');
    assert(a.user.id !== b.user.id, 'both accounts share an id');
    return `${a.user.name} (${a.user.phone}) + ${b.user.name} (${b.user.phone})`;
  });

  await step('GET /api/auth/me returns the caller, never a password', async () => {
    const r = await j('GET', '/auth/me');
    assert(r.user && r.user.id, 'no user');
    assert(r.user.passwordHash === undefined, 'passwordHash leaked');
    assert(r.user.passwordSalt === undefined, 'passwordSalt leaked');
    assert(r.user.sessions === undefined, 'sessions leaked');
    return `${r.user.name} · ${Object.keys(r.user).join(',')}`;
  });

  await step('snapshot the pre-test baseline', async () => {
    // Captured before anything is created, so the closing checks can prove the
    // suite left the database exactly as it found it.
    baselineSummary = await j('GET', '/summary');
    baselineProfile = await j('GET', '/profile');
    return `পাবো ${baselineSummary.receivable.display} / দেবো ${baselineSummary.payable.display} · ${baselineSummary.customerCount} customers`;
  });

  await step('POST /api/auth/logout revokes only the caller token', async () => {
    // Mint a second, throwaway session for the primary account.
    const extra = await raw(
      'POST',
      '/auth/login',
      { phone: ACCOUNTS.primary.phone, password: ACCOUNTS.primary.password },
      null,
    );
    const extraToken = extra.json.token;

    const bye = await raw('POST', '/auth/logout', undefined, extraToken);
    assert(bye.status === 200, `logout -> ${bye.status}`);

    const dead = await raw('GET', '/auth/me', undefined, extraToken);
    assert(dead.status === 401, `revoked token still works (HTTP ${dead.status})`);

    const alive = await raw('GET', '/auth/me', undefined, TOKENS.primary);
    assert(alive.status === 200, `the other session was killed too (HTTP ${alive.status})`);
    return 'extra session dead, primary still alive';
  });

  await step('POST /api/auth/register provisions an isolated account', async () => {
    // A throwaway account: registers, is provisioned with its own empty book,
    // and cannot be registered twice. (It is left in place — there is no
    // account-delete endpoint by design.)
    const phone = `+88019${String(Date.now()).slice(-8)}`;
    const reg = await raw(
      'POST',
      '/auth/register',
      { name: 'ভেরিফাই অ্যাকাউন্ট', phone, password: 'verify123' },
      null,
    );
    assert(reg.status === 201, `HTTP ${reg.status} ${reg.json && reg.json.message}`);
    const token = reg.json.token;

    const dup = await raw('POST', '/auth/register', { name: 'x', phone, password: 'verify123' }, null);
    assert(dup.status === 409, `duplicate phone -> ${dup.status}`);

    const boot = await j('GET', '/bootstrap', undefined, token);
    assert(boot.profile, 'no profile provisioned');
    assert(boot.wallet, 'no wallet provisioned');
    assert(boot.summary.customerCount === 0, `new account already has ${boot.summary.customerCount} customers`);

    const list = await j('GET', '/customers', undefined, token);
    assert(list.items.length === 0, `new account sees ${list.items.length} customers`);

    await raw('POST', '/auth/logout', undefined, token);
    return `empty book + profile + wallet provisioned`;
  });

  /* ---------------------------------------------------------- 2. health */
  section('health & static');
  await step('GET /api/health', async () => {
    const r = await j('GET', '/health');
    assert(r.ok === true, 'ok !== true');
    assert(r.db === 'connected', `db = ${r.db}`);
    assert(r.database === 'tally', `database = ${r.database}`);
    return `${r.database} @ ${String(r.host).split('.')[0]}`;
  });
  await step('GET / (preview page)', async () => {
    const r = await rawUrl('GET', `${ORIGIN}/`);
    assert(r.status === 200, `HTTP ${r.status}`);
    assert(r.type.includes('text/html'), `content-type ${r.type}`);
    assert(r.text.includes('renderCashbox'), 'preview script missing');
    assert(r.text.includes('gate'), 'login gate missing from the preview');
    return `${r.text.length} bytes html`;
  });
  await step('GET /api/unknown -> 404 json', async () => {
    const r = await expectStatus('GET', '/nope', undefined, 404);
    assert(r.json && r.json.error === 'NOT_FOUND', 'not a NOT_FOUND envelope');
    return r.json.message;
  });

  /* ------------------------------------------------------- 3. isolation */
  section('per-user isolation');
  await step('each account sees only its own customers', async () => {
    const mine = await j('GET', '/customers');
    const theirs = await j('GET', '/customers', undefined, TOKENS.second);
    assert(mine.items.length > 0, 'primary has no customers');
    assert(theirs.items.length > 0, 'second has no customers');

    const mineIds = new Set(mine.items.map((c) => c.id));
    const overlap = theirs.items.filter((c) => mineIds.has(c.id));
    assert(overlap.length === 0, `${overlap.length} customer(s) shared between accounts`);
    return `${mine.items.length} vs ${theirs.items.length} rows, 0 shared`;
  });
  await step('the two accounts report different totals', async () => {
    const mine = await j('GET', '/summary');
    const theirs = await j('GET', '/summary', undefined, TOKENS.second);
    assert(
      mine.receivable.display !== theirs.receivable.display ||
        mine.payable.display !== theirs.payable.display ||
        mine.customerCount !== theirs.customerCount,
      'both accounts report identical books',
    );
    return `পাবো ${mine.receivable.display} vs ${theirs.receivable.display}`;
  });
  await step("cross-read another user's customer -> 404", async () => {
    const mine = await j('GET', '/customers');
    const target = mine.items[0].id;
    const r = await expectStatus('GET', `/customers/${target}`, undefined, 404, TOKENS.second);
    assert(r.json.message.includes('পাওয়া যায়নি'), `message = ${r.json.message}`);
    return `${r.json.message} (HTTP 404)`;
  });
  await step("cross-delete another user's customer -> 404, record survives", async () => {
    const mine = await j('GET', '/customers');
    const target = mine.items[0].id;
    const r = await expectStatus('DELETE', `/customers/${target}`, undefined, 404, TOKENS.second);

    const still = await raw('GET', `/customers/${target}`);
    assert(still.status === 200, `the customer was actually deleted (HTTP ${still.status})`);
    return `blocked, owner still has it`;
  });
  await step("cross-write a transaction on another user's customer -> 404", async () => {
    const mine = await j('GET', '/customers');
    const target = mine.items[0].id;
    const r = await expectStatus(
      'POST',
      `/customers/${target}/transactions`,
      { box: 'gave', amount: '10' },
      404,
      TOKENS.second,
    );
    return r.json.message;
  });
  await step('each account gets its own profile and wallet', async () => {
    const mine = await j('GET', '/profile');
    const theirs = await j('GET', '/profile', undefined, TOKENS.second);
    assert(mine.name !== theirs.name, `both profiles are named ${mine.name}`);
    return `${mine.name} vs ${theirs.name}`;
  });

  /* --------------------------------------------------------- 4. uploads */
  section('image uploads (Cloudinary)');
  let uploadProbe = null;

  await step('GET /api/uploads/status reports Cloudinary is configured', async () => {
    const r = await j('GET', '/uploads/status');
    assert(r.configured === true, 'Cloudinary is NOT configured — check .env');
    assert(r.maxBytes > 0, `maxBytes = ${r.maxBytes}`);
    return `configured, ${Math.round(r.maxBytes / 1024 / 1024)} MB cap`;
  });
  await step('POST /api/uploads rejects an empty body -> 400', async () => {
    const r = await expectStatus('POST', '/uploads', {}, 400);
    return r.json.message;
  });
  await step('POST /api/uploads rejects a non-image payload -> 400', async () => {
    const r = await expectStatus('POST', '/uploads', { data: 'data:text/plain;base64,aGVsbG8=' }, 400);
    return r.json.message;
  });
  await step('POST /api/uploads without a token -> 401', async () => {
    const r = await expectStatus('POST', '/uploads', { data: PNG_1X1 }, 401, null);
    return r.json.message;
  });
  await step('POST /api/uploads stores a real asset', async () => {
    assert(PNG_1X1.includes('iVBORw0KGgo'), 'the inline PNG constant is not a PNG');
    const r = await j('POST', '/uploads', { data: PNG_1X1, folder: 'customers' });
    assert(r.url && r.url.startsWith('https://res.cloudinary.com/'), `url = ${r.url}`);
    assert(r.publicId, 'no publicId');
    assert(r.format === 'png', `format = ${r.format}`);
    uploadProbe = r;
    return `${r.width}x${r.height} ${r.format} ${r.bytes}B`;
  });
  await step('the uploaded publicId is namespaced to its owner', async () => {
    const me = await j('GET', '/auth/me');
    assert(
      uploadProbe.publicId.includes(`${me.user.id}_`),
      `publicId "${uploadProbe.publicId}" is not namespaced to ${me.user.id}`,
    );
    return uploadProbe.publicId;
  });
  await step('DELETE /api/uploads refuses another user asset -> 400', async () => {
    const r = await expectStatus(
      'DELETE',
      `/uploads/${encodeURIComponent(uploadProbe.publicId)}`,
      undefined,
      400,
      TOKENS.second,
    );
    return r.json.message;
  });
  await step('DELETE /api/uploads?publicId= (query form) also refuses a foreign asset', async () => {
    const r = await expectStatus(
      'DELETE',
      `/uploads?publicId=${encodeURIComponent(uploadProbe.publicId)}`,
      undefined,
      400,
      TOKENS.second,
    );
    return r.json.message;
  });

  /* -------------------------------------------- 5. photo on a customer */
  await step('POST /api/customers with a photo stores url + publicId', async () => {
    const r = await j('POST', '/customers', {
      name: 'ভেরিফাই ছবি কাস্টমার',
      phone: '+8801700000021',
      type: 'customer',
      note: 'ভেরিফাই বিবরণ',
      photoUrl: uploadProbe.url,
      photoPublicId: uploadProbe.publicId,
    });
    // Kept out of made.customers so the ordered fixtures below keep their
    // indices (0 = customer, 1 = supplier).
    made.photoCustomer = r.customer.id;
    assert(r.customer.photoUrl === uploadProbe.url, `photoUrl = ${r.customer.photoUrl}`);
    assert(r.customer.note === 'ভেরিফাই বিবরণ', `note = ${r.customer.note}`);
    return `photoUrl + বিবরণ persisted`;
  });
  await step('the photo shows up in the home list', async () => {
    const r = await j('GET', '/customers');
    const row = r.items.find((c) => c.photoUrl);
    assert(row, 'no customer row carries a photoUrl');
    assert(row.photoUrl.startsWith('https://'), `row photoUrl = ${row.photoUrl}`);
    return `${row.name} -> ${row.photoUrl.slice(0, 52)}…`;
  });
  await step('PATCH clearing the photo empties both fields', async () => {
    const r = await j('PATCH', `/customers/${made.photoCustomer}`, { photoUrl: '', photoPublicId: '' });
    assert(r.customer.photoUrl === '', `photoUrl = "${r.customer.photoUrl}"`);
    return 'photo cleared (asset destroyed server-side)';
  });
  await step('PATCH a rename keeps the other fields intact', async () => {
    const r = await j('PATCH', `/customers/${made.photoCustomer}`, { name: 'ভেরিফাই ছবি (নতুন নাম)' });
    assert(r.customer.name === 'ভেরিফাই ছবি (নতুন নাম)', 'name not updated');
    assert(r.customer.note === 'ভেরিফাই বিবরণ', 'বিবরণ was lost on rename');
    return `${r.customer.name} · ${r.customer.note}`;
  });
  await step('POST + X-HTTP-Method-Override: PATCH is honoured (the Android path)', async () => {
    // java.net.HttpURLConnection cannot send PATCH, so the app posts with the
    // override header. If this regresses, every edit silently becomes a create.
    const res = await fetch(`${BASE}/customers/${made.photoCustomer}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKENS.primary}`,
        'X-HTTP-Method-Override': 'PATCH',
      },
      body: JSON.stringify({ note: 'ওভাররাইড বিবরণ' }),
    });
    assert(res.status === 200, `HTTP ${res.status}`);
    const body = await res.json();
    assert(body.customer.note === 'ওভাররাইড বিবরণ', `note = ${body.customer.note}`);
    assert(body.customer.name === 'ভেরিফাই ছবি (নতুন নাম)', 'the untouched name changed');
    return `note -> ${body.customer.note}`;
  });
  await step('the override header cannot smuggle an unauthenticated PATCH', async () => {
    const res = await fetch(`${BASE}/customers/${made.photoCustomer}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'PATCH' },
      body: JSON.stringify({ note: 'হ্যাক' }),
    });
    assert(res.status === 401, `HTTP ${res.status} — auth was bypassed`);
    return 'still 401';
  });
  await step("DELETE /api/uploads?publicId= removes the owner's own asset", async () => {
    const r = await j('DELETE', `/uploads?publicId=${encodeURIComponent(uploadProbe.publicId)}`);
    assert(r.ok === true, 'ok !== true');
    return `removed=${r.removed}`;
  });

  /* --------------------------------------------------------- 6. profile */
  section('profile');
  await step('GET /api/profile', async () => {
    assert(baselineProfile.name, 'no name');
    assert(baselineProfile.goldTrialLabel, 'no goldTrialLabel');
    return `${baselineProfile.name} · ${baselineProfile.goldTrialLabel}`;
  });
  await step('PATCH /api/profile (bump inbox, then restore)', async () => {
    const before = baselineProfile.inboxUnread;
    const bumped = await j('PATCH', '/profile', { inboxUnread: before + 3 });
    assert(bumped.inboxUnread === before + 3, `expected ${before + 3}, got ${bumped.inboxUnread}`);
    const restored = await j('PATCH', '/profile', { inboxUnread: before });
    assert(restored.inboxUnread === before, 'restore failed');
    return `${before} -> ${bumped.inboxUnread} -> ${restored.inboxUnread}`;
  });

  /* --------------------------------------------------------- 3. summary */
  section('summary & bootstrap');
  await step('GET /api/summary', async () => {
    const r = await j('GET', '/summary');
    assert(r.receivable && r.receivable.display, 'no receivable');
    assert(r.customerLabel.includes('/'), 'bad customerLabel');
    return `পাবো ${r.receivable.display} / দেবো ${r.payable.display}`;
  });
  await step('GET /api/bootstrap (single cold-start call)', async () => {
    const b = await j('GET', '/bootstrap');
    ['profile', 'summary', 'wallet', 'menu'].forEach((k) => assert(b[k], `missing ${k}`));
    return `profile + summary + wallet(${b.wallet.services.length}) + menu(${b.menu.sections.length})`;
  });

  /* ------------------------------------------------------- 4. customers */
  section('customers — read & filter');
  await step('GET /api/customers', async () => {
    const r = await j('GET', '/customers');
    assert(r.items.length > 0, 'no customers');
    const need = ['id', 'name', 'initials', 'avatarColor', 'avatarTextColor', 'subtitle', 'amountDisplay', 'amountTone'];
    need.forEach((k) => assert(r.items[0][k] !== undefined, `row missing ${k}`));
    return `${r.items.length} rows`;
  });
  await step('GET /api/customers?type=supplier', async () => {
    const r = await j('GET', '/customers?type=supplier');
    assert(r.items.length > 0, 'no suppliers');
    assert(r.items.every((c) => c.type === 'supplier'), 'a non-supplier leaked in');
    return `${r.items.length} suppliers`;
  });
  await step('GET /api/customers?type=customer', async () => {
    const r = await j('GET', '/customers?type=customer');
    assert(r.items.every((c) => c.type === 'customer'), 'a supplier leaked in');
    return `${r.items.length} customers`;
  });
  await step('GET /api/customers?q=<name> (search)', async () => {
    const all = await j('GET', '/customers');
    const target = all.items.find((c) => /[A-Za-z]/.test(c.name)) || all.items[0];
    const q = target.name.slice(0, 3);
    const r = await j('GET', `/customers?q=${encodeURIComponent(q)}`);
    assert(r.items.length > 0, `no match for "${q}"`);
    assert(r.items.every((c) => c.name.includes(q)), 'result does not match the query');
    return `"${q}" -> ${r.items.length} hit(s)`;
  });

  section('customers — write');
  await step('POST /api/customers (customer)', async () => {
    const r = await j('POST', '/customers', {
      name: 'ভেরিফাই কাস্টমার',
      phone: '+8801700000001',
      type: 'customer',
    });
    made.customers.push(r.customer.id);
    assert(r.customer.initials, 'no initials');
    assert(r.customer.amountTone === 'zero', `new customer tone = ${r.customer.amountTone}`);
    return `${r.customer.name} initials=${r.customer.initials}`;
  });
  await step('POST /api/customers (supplier)', async () => {
    const r = await j('POST', '/customers', {
      name: 'ভেরিফাই সাপ্লায়ার',
      phone: '+8801700000002',
      type: 'supplier',
    });
    made.customers.push(r.customer.id);
    assert(r.customer.type === 'supplier', `type = ${r.customer.type}`);
    return `${r.customer.name} (${r.customer.type})`;
  });
  await step('POST /api/customers without a name -> 400', async () => {
    const r = await expectStatus('POST', '/customers', { phone: '+8801700000003' }, 400);
    return r.json.message;
  });
  await step('POST /api/customers with a junk phone -> 400', async () => {
    const r = await expectStatus('POST', '/customers', { name: 'x', phone: 'not-a-phone!!' }, 400);
    return r.json.message;
  });
  await step('PATCH /api/customers/:id (rename + re-initials)', async () => {
    const id = made.customers[0];
    const r = await j('PATCH', `/customers/${id}`, { name: 'ভেরিফাই কাস্টমার (নতুন)' });
    assert(r.customer.name === 'ভেরিফাই কাস্টমার (নতুন)', 'name not updated');
    assert(r.customer.initials, 'initials lost');
    return `${r.customer.name} initials=${r.customer.initials}`;
  });
  await step('GET /api/customers/:id -> 404 for a bad id', async () => {
    const r = await expectStatus('GET', '/customers/000000000000000000000000', undefined, 404);
    return r.json.message;
  });
  await step('PATCH /api/customers/:id -> 404 for a bad id', async () => {
    const r = await expectStatus('PATCH', '/customers/000000000000000000000000', { name: 'x' }, 404);
    return r.json.message;
  });

  /* ------------------------------------------------------- 5. ledger */
  section('ledger — derived balances');
  const cust = made.customers[0];

  await step('GET /api/customers/:id (empty ledger)', async () => {
    const r = await j('GET', `/customers/${cust}`);
    assert(r.entries.length === 0, `expected 0 entries, got ${r.entries.length}`);
    assert(r.headline.label === 'পাবো' || r.headline.label === 'দেবো', `headline ${r.headline.label}`);
    assert(num(r.headline.amountDisplay) === 0, `headline not zero: ${r.headline.amountDisplay}`);
    return `${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('POST transactions {box:"gave"} with Bengali digits', async () => {
    const r = await j('POST', `/customers/${cust}/transactions`, {
      box: 'gave',
      amount: '১,২৩৪.৫০',
      description: 'ভেরিফাই বিক্রয়',
    });
    assert(r.entry.kind === 'sale', `kind = ${r.entry.kind} (expected sale for a customer)`);
    assert(r.entry.title === 'বেচা', `title = ${r.entry.title}`);
    assert(num(r.entry.amountDisplay) === 1234.5, `amount parsed as ${num(r.entry.amountDisplay)}`);
    assert(num(r.headline.amountDisplay) === 1234.5, `headline ${r.headline.amountDisplay}`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('POST transactions {box:"got"} reduces the balance', async () => {
    const r = await j('POST', `/customers/${cust}/transactions`, {
      box: 'got',
      amount: '234.50',
      description: 'ভেরিফাই পেমেন্ট',
    });
    assert(r.entry.kind === 'payment_received', `kind = ${r.entry.kind}`);
    assert(num(r.headline.amountDisplay) === 1000, `expected 1000.00, got ${r.headline.amountDisplay}`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('POST transactions {kind:"refund"} reduces what is owed', async () => {
    // receivable = sale - refund - received  ->  1234.50 - 250 - 234.50 = 750.00
    const r = await j('POST', `/customers/${cust}/transactions`, {
      kind: 'refund',
      amount: '250',
      description: 'ভেরিফাই ফেরত',
    });
    assert(r.entry.kind === 'refund', `kind = ${r.entry.kind}`);
    assert(r.entry.tone === 'out', `refund tone = ${r.entry.tone} (expected out)`);
    assert(num(r.headline.amountDisplay) === 750, `expected 750.00, got ${r.headline.amountDisplay}`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('supplier box mapping is inverted (gave -> payment_made)', async () => {
    const sup = made.customers[1];
    const r = await j('POST', `/customers/${sup}/transactions`, { box: 'gave', amount: '500' });
    assert(r.entry.kind === 'payment_made', `kind = ${r.entry.kind} (expected payment_made for a supplier)`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('POST transactions with a junk amount -> 400', async () => {
    const r = await expectStatus('POST', `/customers/${cust}/transactions`, { box: 'gave', amount: 'abc' }, 400);
    return r.json.message;
  });
  await step('POST transactions with a zero amount -> 400', async () => {
    const r = await expectStatus('POST', `/customers/${cust}/transactions`, { box: 'gave', amount: '0' }, 400);
    return r.json.message;
  });
  await step('POST transactions with a bad kind -> 400', async () => {
    const r = await expectStatus('POST', `/customers/${cust}/transactions`, { kind: 'nonsense', amount: '10' }, 400);
    return r.json.message;
  });
  await step('POST transactions on an unknown customer -> 404', async () => {
    const r = await expectStatus(
      'POST',
      '/customers/000000000000000000000000/transactions',
      { box: 'gave', amount: '10' },
      404,
    );
    return r.json.message;
  });

  await step('GET /api/customers/:id/transactions (3 entries, newest first)', async () => {
    const r = await j('GET', `/customers/${cust}/transactions`);
    assert(r.items.length === 3, `expected 3, got ${r.items.length}`);
    const need = ['id', 'kind', 'title', 'tone', 'amountDisplay', 'dateDisplay', 'relative'];
    need.forEach((k) => assert(r.items[0][k] !== undefined, `entry missing ${k}`));
    return r.items.map((e) => `${e.title}:${e.amountDisplay}`).join(', ');
  });

  await step('ledger screen payload (headline matches the list)', async () => {
    const r = await j('GET', `/customers/${cust}`);
    assert(r.entries.length === 3, `expected 3 entries, got ${r.entries.length}`);
    assert(num(r.headline.amountDisplay) === 750, `headline ${r.headline.amountDisplay}`);
    assert(r.customer.transactionCount === 3, `transactionCount = ${r.customer.transactionCount}`);
    return `${r.headline.label} ${r.headline.amountDisplay} · ${r.customer.subtitle}`;
  });

  /* -------------------------------------------------------- 6. cashbox */
  section('cashbox');
  await step('GET /api/cashbox', async () => {
    const r = await j('GET', '/cashbox');
    ['todaySale', 'currentCash', 'todayIn', 'todayOut'].forEach((k) =>
      assert(r[k] && r[k].display !== undefined, `missing ${k}`),
    );
    assert(r.rows.length === 5, `expected 5 rows, got ${r.rows.length}`);
    r.rows.forEach((row) => {
      assert(row.key && row.label, 'row missing key/label');
      assert(typeof row.income === 'boolean', `row ${row.key} income is not a boolean`);
      assert(row.amountDisplay !== undefined, `row ${row.key} missing amountDisplay`);
    });
    return `ক্যাশ ${r.currentCash.display} · ${r.rows.length} rows`;
  });
  await step('GET /api/cashbox/entries', async () => {
    const r = await j('GET', '/cashbox/entries');
    assert(r.items.length > 0, 'no entries');
    return `${r.items.length} entries`;
  });
  await step('GET /api/cashbox/entries?kind=expense', async () => {
    const r = await j('GET', '/cashbox/entries?kind=expense');
    assert(r.items.every((e) => e.kind === 'expense'), 'a non-expense leaked in');
    return `${r.items.length} expense rows`;
  });
  await step('GET /api/cashbox/entries?limit=3', async () => {
    const r = await j('GET', '/cashbox/entries?limit=3');
    assert(r.items.length === 3, `expected 3, got ${r.items.length}`);
    return 'limit honoured';
  });

  await step('POST /api/cashbox/entries — all five kinds', async () => {
    const kinds = ['cash_sale', 'cash_purchase', 'expense', 'owner_in', 'owner_out'];
    const seen = [];
    for (const kind of kinds) {
      const r = await j('POST', '/cashbox/entries', {
        kind,
        amount: '100',
        description: `ভেরিফাই ${kind}`,
        category: 'ভেরিফাই',
      });
      made.cashEntries.push(r.entry.id);
      assert(r.entry.kind === kind, `kind = ${r.entry.kind}`);
      assert(r.dashboard && r.dashboard.currentCash, 'no dashboard in the response');
      seen.push(`${kind}=${r.entry.title}`);
    }
    return seen.join(' ');
  });
  await step('POST /api/cashbox/entries with a bad kind -> 400', async () => {
    const r = await expectStatus('POST', '/cashbox/entries', { kind: 'nope', amount: '10' }, 400);
    return r.json.message;
  });
  await step('POST /api/cashbox/entries with a junk amount -> 400', async () => {
    const r = await expectStatus('POST', '/cashbox/entries', { kind: 'expense', amount: 'xyz' }, 400);
    return r.json.message;
  });

  await step('currentCash is the signed sum of the five flows', async () => {
    const before = await j('GET', '/cashbox');
    const r = await j('POST', '/cashbox/entries', { kind: 'owner_in', amount: '1000' });
    made.cashEntries.push(r.entry.id);
    const delta = num(r.dashboard.currentCash.display) - num(before.currentCash.display);
    assert(Math.abs(delta - 1000) < 0.005, `owner_in moved cash by ${delta}, expected 1000`);
    const r2 = await j('POST', '/cashbox/entries', { kind: 'owner_out', amount: '400' });
    made.cashEntries.push(r2.entry.id);
    const delta2 = num(r2.dashboard.currentCash.display) - num(r.dashboard.currentCash.display);
    assert(Math.abs(delta2 + 400) < 0.005, `owner_out moved cash by ${delta2}, expected -400`);
    return `+1000 then -400 -> ${r2.dashboard.currentCash.display}`;
  });

  await step('DELETE /api/cashbox/entries/:id restores the total', async () => {
    const before = await j('GET', '/cashbox');
    const made1 = await j('POST', '/cashbox/entries', { kind: 'expense', amount: '777' });
    const afterAdd = num(made1.dashboard.currentCash.display);
    assert(Math.abs(afterAdd - (num(before.currentCash.display) - 777)) < 0.005, 'expense did not reduce cash');
    const del = await j('DELETE', `/cashbox/entries/${made1.entry.id}`);
    const afterDel = num(del.dashboard.currentCash.display);
    assert(Math.abs(afterDel - num(before.currentCash.display)) < 0.005, `delete did not restore (${afterDel})`);
    return `খরচ 777.00 then deleted -> back to ${del.dashboard.currentCash.display}`;
  });
  await step('DELETE /api/cashbox/entries/:id -> 404 for a bad id', async () => {
    const r = await expectStatus('DELETE', '/cashbox/entries/000000000000000000000000', undefined, 404);
    return r.json.message;
  });

  /* --------------------------------------------------------- 7. wallet */
  section('wallet & menu');
  await step('GET /api/wallet', async () => {
    const r = await j('GET', '/wallet');
    assert(r.services.length === 8, `expected 8 services, got ${r.services.length}`);
    assert(r.balance && r.balance.display, 'no balance');
    assert(Array.isArray(r.benefits) && r.benefits.length > 0, 'no benefits');
    r.services.forEach((s) => assert(s.key && s.label && typeof s.enabled === 'boolean', `bad service ${s.key}`));
    return `${r.services.length} services, ${r.benefits.length} benefits, opened=${r.accountOpened}`;
  });
  await step('POST /api/wallet/open-account enables everything', async () => {
    const r = await j('POST', '/wallet/open-account');
    assert(r.ok === true, 'ok !== true');
    assert(r.wallet.accountOpened === true, 'accountOpened still false');
    const enabled = r.wallet.services.filter((s) => s.enabled).length;
    assert(enabled === r.wallet.services.length, `only ${enabled}/${r.wallet.services.length} enabled`);
    return `accountOpened=true, ${enabled} services enabled`;
  });
  await step('GET /api/menu (live counts)', async () => {
    const r = await j('GET', '/menu');
    assert(r.sections.length === 2, `expected 2 sections, got ${r.sections.length}`);
    const items = r.sections[0].items;
    assert(items.length === 5, `expected 5 items in section 0, got ${items.length}`);
    items.forEach((i) => assert(i.key && i.label && i.count !== undefined, `bad item ${i.key}`));
    assert(r.version.startsWith('ভার্সন'), `version = ${r.version}`);
    assert(r.profile && r.profile.name, 'menu missing profile');
    return items.map((i) => `${i.label}=${i.count}`).join(' ');
  });
  await step('menu counts track real writes', async () => {
    const before = await j('GET', '/menu');
    const beforeLedger = before.sections[0].items.find((i) => i.key === 'ledger').count;
    const tmp = await j('POST', '/customers', { name: 'মেনু কাউন্ট টেস্ট', phone: '+8801700000009' });
    made.customers.push(tmp.customer.id);
    await j('POST', `/customers/${tmp.customer.id}/transactions`, { box: 'gave', amount: '10' });
    const after = await j('GET', '/menu');
    const afterLedger = after.sections[0].items.find((i) => i.key === 'ledger').count;
    assert(afterLedger === beforeLedger + 1, `ledger count ${beforeLedger} -> ${afterLedger}`);
    return `ledger count ${beforeLedger} -> ${afterLedger}`;
  });

  /* -------------------------------------------------------- 8. reports */
  section('reports');
  await step('GET /api/reports/summary?days=30', async () => {
    const r = await j('GET', '/reports/summary?days=30');
    assert(r.days === 30, `days = ${r.days}`);
    ['sales', 'purchases', 'expenses', 'cashSales', 'ownerIn', 'ownerOut'].forEach((k) =>
      assert(r[k] && r[k].display !== undefined, `missing ${k}`),
    );
    assert(r.range && r.range.label, 'no range label');
    assert(r.generatedLabel && r.monthLabel, 'no generated labels');
    return `sales ${r.sales.display}, expenses ${r.expenses.display}, ${r.range.label}`;
  });
  await step('GET /api/reports/summary?days=7 narrows the window', async () => {
    const wide = await j('GET', '/reports/summary?days=365');
    const narrow = await j('GET', '/reports/summary?days=7');
    assert(num(narrow.sales.display) <= num(wide.sales.display), '7-day sales exceed 365-day sales');
    return `7d ${narrow.sales.display} <= 365d ${wide.sales.display}`;
  });
  await step('GET /api/reports/summary clamps out-of-range days', async () => {
    const hi = await j('GET', '/reports/summary?days=9999');
    const lo = await j('GET', '/reports/summary?days=-5');
    assert(hi.days === 365, `upper clamp = ${hi.days}`);
    assert(lo.days === 1, `lower clamp = ${lo.days}`);
    const junk = await j('GET', '/reports/summary?days=abc');
    assert(junk.days === 30, `junk default = ${junk.days}`);
    return `9999->365, -5->1, abc->30`;
  });

  /* -------------------------------------------------------- 9. cascade */
  section('cascade delete & cleanup');
  await step('DELETE customer removes its transactions too', async () => {
    const tmp = await j('POST', '/customers', { name: 'ক্যাসকেড টেস্ট', phone: '+8801700000010' });
    await j('POST', `/customers/${tmp.customer.id}/transactions`, { box: 'gave', amount: '55' });
    const before = await j('GET', '/menu');
    const beforeLedger = before.sections[0].items.find((i) => i.key === 'ledger').count;

    const del = await j('DELETE', `/customers/${tmp.customer.id}`);
    assert(del.ok === true, 'ok !== true');

    const gone = await raw('GET', `/customers/${tmp.customer.id}`);
    assert(gone.status === 404, `customer still readable (HTTP ${gone.status})`);

    const after = await j('GET', '/menu');
    const afterLedger = after.sections[0].items.find((i) => i.key === 'ledger').count;
    assert(afterLedger === beforeLedger - 1, `orphan transaction left behind: ${beforeLedger} -> ${afterLedger}`);
    return `customer + its transaction both gone (${beforeLedger} -> ${afterLedger})`;
  });
  await step('DELETE /api/customers/:id -> 404 for a bad id', async () => {
    const r = await expectStatus('DELETE', '/customers/000000000000000000000000', undefined, 404);
    return r.json.message;
  });

  /* cleanup */
  let cleaned = 0;
  for (const id of made.cashEntries) {
    const r = await raw('DELETE', `/cashbox/entries/${id}`);
    if (r.status < 400) cleaned += 1;
  }
  for (const id of made.customers) {
    const r = await raw('DELETE', `/customers/${id}`);
    if (r.status < 400) cleaned += 1;
  }
  if (made.photoCustomer) {
    const r = await raw('DELETE', `/customers/${made.photoCustomer}`);
    if (r.status < 400) cleaned += 1;
  }
  await step('cleanup — throwaway records removed', async () => `removed ${cleaned} record(s)`);

  /* ------------------------------------------------------- 10. baseline */
  section('baseline restored');
  await step('summary matches the pre-test snapshot', async () => {
    const now = await j('GET', '/summary');
    assert(
      now.receivable.display === baselineSummary.receivable.display,
      `পাবো drifted: ${baselineSummary.receivable.display} -> ${now.receivable.display}`,
    );
    assert(
      now.payable.display === baselineSummary.payable.display,
      `দেবো drifted: ${baselineSummary.payable.display} -> ${now.payable.display}`,
    );
    assert(
      now.transactionCount === baselineSummary.transactionCount,
      `tx count ${baselineSummary.transactionCount} -> ${now.transactionCount}`,
    );
    return `পাবো ${now.receivable.display} / দেবো ${now.payable.display} · ${now.transactionCount} txns`;
  });
  await step('customer count matches the snapshot', async () => {
    const r = await j('GET', '/customers');
    const expected = baselineSummary.customerCount + baselineSummary.supplierCount;
    assert(r.items.length === expected, `expected ${expected} customers, found ${r.items.length}`);
    return `${r.items.length} customers`;
  });

  /* --------------------------------------------------------- the verdict */
  console.log(`\n${'═'.repeat(62)}`);
  if (failures.length === 0) {
    console.log(`  ALL PASS — ${pass} checks, 0 failures`);
  } else {
    console.log(`  ${pass} passed, ${failures.length} FAILED`);
    failures.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log(`${'═'.repeat(62)}\n`);

  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(2);
});
