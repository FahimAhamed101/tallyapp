/**
 * End-to-end smoke test for every endpoint the Android app calls.
 * Run the server first:  npm start
 * Then:                  node smoke.js
 *
 * Logs in with the seeded demo account first, because everything except
 * /health and /auth/* now needs a bearer token.
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:4000/api';
const PHONE = process.env.SMOKE_PHONE || '01706617723';
const PASSWORD = process.env.SMOKE_PASSWORD || '123456';

/** Set by the login step; attached to every later request. */
let TOKEN = null;

let pass = 0;
let fail = 0;
const created = { customerId: null, cashEntryId: null, publicId: null, photoUrl: null };

/** A real 1x1 PNG — small enough to inline, valid enough for Cloudinary. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function ok(label, extra = '') {
  pass += 1;
  console.log(`  PASS  ${label}${extra ? '  ' + extra : ''}`);
}
function bad(label, err) {
  fail += 1;
  console.log(`  FAIL  ${label}  ->  ${err}`);
}

async function call(method, path, body, token = TOKEN) {
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
    /* non-json */
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${json && json.message ? json.message : text.slice(0, 120)}`);
  }
  return json;
}

async function step(label, fn) {
  try {
    const extra = await fn();
    ok(label, extra || '');
  } catch (e) {
    bad(label, e.message);
  }
}

(async () => {
  console.log(`\nTallyKhata API smoke test -> ${BASE}\n`);

  await step('GET  /health', async () => {
    const r = await call('GET', '/health', undefined, null);
    if (!r.ok) throw new Error(`db state ${r.db}`);
    return `db=${r.database} host=${String(r.host).split('.')[0]}`;
  });

  await step('GET  /customers without a token -> 401', async () => {
    try {
      await call('GET', '/customers', undefined, null);
    } catch (e) {
      if (!e.message.startsWith('401')) throw new Error(`expected 401, got ${e.message}`);
      return 'blocked';
    }
    throw new Error('an unauthenticated request was allowed through');
  });

  await step('POST /auth/login (phone + password)', async () => {
    const r = await call('POST', '/auth/login', { phone: PHONE, password: PASSWORD }, null);
    if (!r.token) throw new Error('no token');
    TOKEN = r.token;
    return `${r.user.name} · ${r.user.phone}`;
  });

  await step('GET  /bootstrap', async () => {
    const r = await call('GET', '/bootstrap');
    if (!r.profile || !r.summary) throw new Error('missing profile/summary');
    if (!r.user || !r.user.id) throw new Error('bootstrap is missing the user object');
    return `profile=${r.profile.name} customers=${r.summary.customerLabel}`;
  });

  await step('GET  /summary', async () => {
    const r = await call('GET', '/summary');
    return `পাবো ${r.receivable.display} / দেবো ${r.payable.display}`;
  });

  await step('GET  /customers', async () => {
    const r = await call('GET', '/customers');
    if (!r.items.length) throw new Error('no customers');
    const first = r.items[1] || r.items[0];
    return `${r.items.length} rows, e.g. ${first.name} ${first.amountDisplay} (${first.amountTone})`;
  });

  await step('POST /customers', async () => {
    const r = await call('POST', '/customers', {
      name: 'স্মোক টেস্ট দোকান',
      phone: '+8801799999999',
      type: 'customer',
    });
    created.customerId = r.customer.id;
    return `created ${r.customer.name} initials=${r.customer.initials}`;
  });

  await step('GET  /customers/:id', async () => {
    const r = await call('GET', `/customers/${created.customerId}`);
    return `headline ${r.headline.label} ${r.headline.amountDisplay}, ${r.entries.length} entries`;
  });

  // ---- photo: the camera/gallery path, exactly as the app drives it --------
  await step('POST /uploads (base64 data URI -> Cloudinary)', async () => {
    const r = await call('POST', '/uploads', { data: PNG_1X1, folder: 'customers' });
    if (!r.url.startsWith('https://res.cloudinary.com/')) throw new Error(`url = ${r.url}`);
    if (!r.publicId) throw new Error('no publicId');
    created.publicId = r.publicId;
    created.photoUrl = r.url;
    return `${r.width}x${r.height} ${r.format} ${r.bytes}B`;
  });

  await step('attach the photo via X-HTTP-Method-Override: PATCH', async () => {
    // java.net.HttpURLConnection cannot send PATCH; this is what the app does.
    const res = await fetch(`${BASE}/customers/${created.customerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'X-HTTP-Method-Override': 'PATCH',
      },
      body: JSON.stringify({
        note: 'স্মোক টেস্ট বিবরণ',
        photoUrl: created.photoUrl,
        photoPublicId: created.publicId,
      }),
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const r = await res.json();
    if (r.customer.note !== 'স্মোক টেস্ট বিবরণ') throw new Error(`note = ${r.customer.note}`);
    if (!r.customer.photoUrl) throw new Error('photoUrl not stored');
    created.photoUrl = r.customer.photoUrl;
    return `note + photoUrl persisted`;
  });
  await step('the photo is visible in the home list', async () => {
    const r = await call('GET', '/customers');
    const row = r.items.find((c) => c.id === created.customerId);
    if (!row) throw new Error('customer missing from the list');
    if (!row.photoUrl.startsWith('https://')) throw new Error(`row photoUrl = ${row.photoUrl}`);
    return `${row.name} -> ${row.photoUrl.slice(0, 48)}…`;
  });

  await step('POST /customers/:id/transactions (gave -> বেচা)', async () => {
    const r = await call('POST', `/customers/${created.customerId}/transactions`, {
      box: 'gave',
      amount: '১,২৩৪.৫০',
      description: 'স্মোক টেস্ট বিক্রয়',
    });
    if (r.entry.kind !== 'sale') throw new Error(`expected sale, got ${r.entry.kind}`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('POST /customers/:id/transactions (got -> পেলাম)', async () => {
    const r = await call('POST', `/customers/${created.customerId}/transactions`, {
      box: 'got',
      amount: '234.50',
      description: 'স্মোক টেস্ট পেমেন্ট',
    });
    if (r.entry.kind !== 'payment_received') throw new Error(`expected payment_received, got ${r.entry.kind}`);
    return `${r.entry.title} ${r.entry.amountDisplay} -> ${r.headline.label} ${r.headline.amountDisplay}`;
  });

  await step('GET  /customers/:id/transactions', async () => {
    const r = await call('GET', `/customers/${created.customerId}/transactions`);
    if (r.items.length !== 2) throw new Error(`expected 2 entries, got ${r.items.length}`);
    return r.items.map((e) => `${e.title}:${e.amountDisplay}`).join(', ');
  });

  await step('GET  /cashbox', async () => {
    const r = await call('GET', '/cashbox');
    return `আজকের বেচা ${r.todaySale.display}, বর্তমান কাশ ${r.currentCash.display}, ${r.rows.length} rows`;
  });

  await step('POST /cashbox/entries', async () => {
    const r = await call('POST', '/cashbox/entries', {
      kind: 'expense',
      amount: '99',
      description: 'স্মোক টেস্ট খরচ',
      category: 'টেস্ট',
    });
    created.cashEntryId = r.entry.id;
    return `খরচ ${r.entry.amountDisplay}, নতুন কাশ ${r.dashboard.currentCash.display}`;
  });

  await step('GET  /menu', async () => {
    const r = await call('GET', '/menu');
    const counts = r.sections[0].items.map((i) => `${i.label}=${i.count}`).join(' ');
    return counts;
  });

  await step('GET  /wallet', async () => {
    const r = await call('GET', '/wallet');
    return `${r.services.length} services, opened=${r.accountOpened}`;
  });

  await step('POST /wallet/open-account', async () => {
    const r = await call('POST', '/wallet/open-account');
    if (!r.wallet.accountOpened) throw new Error('accountOpened still false');
    return `accountOpened=${r.wallet.accountOpened}, enabled=${r.wallet.services.filter((s) => s.enabled).length}`;
  });

  await step('GET  /reports/summary', async () => {
    const r = await call('GET', '/reports/summary?days=30');
    return `sales ${r.sales.display}, expenses ${r.expenses.display}, ${r.range.label}`;
  });

  // ---- cleanup ------------------------------------------------------------
  await step('DELETE /cashbox/entries/:id (cleanup)', async () => {
    await call('DELETE', `/cashbox/entries/${created.cashEntryId}`);
    return 'removed';
  });

  await step('DELETE /customers/:id (cleanup)', async () => {
    await call('DELETE', `/customers/${created.customerId}`);
    return 'removed';
  });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
