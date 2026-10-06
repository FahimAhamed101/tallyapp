import './env';
import { ENDPOINTS } from '../lib/endpoints';

/**
 * Behavioural coverage for the endpoints `smoke.ts` only *probes*.
 *
 *   npm run api-coverage        (server must already be up on :4000)
 *
 * `smoke.ts` walks every catalogue entry, but for many of them it only proves
 * the path is registered (a 405 probe) — it never sends a valid request. That
 * leaves a whole class of endpoint untested: the admin PATCH/DELETE routes, the
 * profile edit, the password change, wallet open-account, and the upload path
 * form. This script exercises each one for real and re-reads the API to confirm
 * the effect.
 *
 * Safety: every user-scoped mutation (profile edit, password change) runs
 * against a **throwaway account**, never the admin's own, so a bug here cannot
 * lock anyone out. Everything created is deleted in a `finally` block.
 */

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4000';
const ADMIN_PHONE = process.env.SMOKE_PHONE || '+8801706617723';
const ADMIN_PASSWORD = process.env.SMOKE_PASSWORD || '123456';

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

interface Res {
  status: number;
  json: any;
  text: string;
}

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string | null; headers?: Record<string, string> } = {},
): Promise<Res> {
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

const stamp = Date.now().toString(36);
const USER_PHONE = `+88018${String(Date.now()).slice(-8)}`;
const USER_NAME = `কভারেজ ${stamp}`;
const USER_PASSWORD = '123456';
const USER_PASSWORD_2 = 'abcdef123';

let adminToken = '';
let userId = '';
let userToken = '';
let customerId = '';
let txId = '';
let cashId = '';
let uploadPublicId = '';
let uploadUrl = '';
/** মাল্টি ব্যবসা: the throwaway account's second book, if one is still standing. */
let businessId = '';

async function main() {
  console.log(`API behavioural coverage against ${BASE}\n`);

  // ---- tokens -----------------------------------------------------------
  const admin = await req('POST', '/api/auth/login', {
    body: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  adminToken = admin.json?.token || '';
  if (!adminToken) {
    console.error('cannot sign in as admin — is the server up?');
    process.exit(1);
  }

  const reg = await req('POST', '/api/auth/register', {
    body: { name: USER_NAME, phone: USER_PHONE, password: USER_PASSWORD },
  });
  userId = reg.json?.user?.id || '';
  userToken = reg.json?.token || '';
  if (!userId) {
    console.error('cannot register the throwaway account:', reg.text.slice(0, 200));
    process.exit(1);
  }
  console.log(`throwaway account ${USER_PHONE} (${userId})\n`);

  // ---- PATCH /api/profile ----------------------------------------------
  console.log('PATCH /api/profile');
  const before = await req('GET', '/api/profile', { token: userToken });
  check('GET /api/profile -> 200', before.status === 200, `got ${before.status}`);

  const edited = await req('PATCH', '/api/profile', {
    token: userToken,
    body: { name: `${USER_NAME} (edited)`, inboxUnread: 7 },
  });
  check('PATCH /api/profile -> 200', edited.status === 200, `got ${edited.status} ${edited.text.slice(0, 120)}`);

  const afterProfile = await req('GET', '/api/profile', { token: userToken });
  // GET/PATCH /api/profile return the profile object directly — it is not
  // wrapped in { profile } like the admin routes are.
  check(
    'profile name persisted',
    afterProfile.json?.name === `${USER_NAME} (edited)`,
    `got "${afterProfile.json?.name}"`,
  );
  check(
    'numeric field coerced',
    afterProfile.json?.inboxUnread === 7,
    `got ${afterProfile.json?.inboxUnread}`,
  );

  // the POST alias for the same route (HttpURLConnection cannot send PATCH)
  const alias = await req('POST', '/api/profile', {
    token: userToken,
    headers: { 'X-HTTP-Method-Override': 'PATCH' },
    body: { name: USER_NAME },
  });
  check('POST + override alias works', alias.status === 200, `got ${alias.status}`);
  const plainPost = await req('POST', '/api/profile', { token: userToken, body: { name: 'x' } });
  check('plain POST on /api/profile -> 404', plainPost.status === 404, `got ${plainPost.status}`);

  // ---- POST /api/auth/password -----------------------------------------
  console.log('\nPOST /api/auth/password');
  const wrongCurrent = await req('POST', '/api/auth/password', {
    token: userToken,
    body: { currentPassword: 'definitely-wrong', newPassword: USER_PASSWORD_2 },
  });
  // A wrong current password is an authentication failure, so the route answers
  // 401 (unauthorized), not 400 — a deliberate choice, not an oversight.
  check('wrong current password -> 401', wrongCurrent.status === 401, `got ${wrongCurrent.status}`);

  const shortNew = await req('POST', '/api/auth/password', {
    token: userToken,
    body: { currentPassword: USER_PASSWORD, newPassword: 'abc' },
  });
  check('too-short new password -> 400', shortNew.status === 400, `got ${shortNew.status}`);

  const changed = await req('POST', '/api/auth/password', {
    token: userToken,
    body: { currentPassword: USER_PASSWORD, newPassword: USER_PASSWORD_2 },
  });
  check('correct current password -> 200', changed.status === 200, `got ${changed.status} ${changed.text.slice(0, 120)}`);

  const oldFails = await req('POST', '/api/auth/login', {
    body: { phone: USER_PHONE, password: USER_PASSWORD },
  });
  check('the old password no longer works', oldFails.status === 401, `got ${oldFails.status}`);

  const newWorks = await req('POST', '/api/auth/login', {
    body: { phone: USER_PHONE, password: USER_PASSWORD_2 },
  });
  check('the new password works', newWorks.status === 200, `got ${newWorks.status}`);
  userToken = newWorks.json?.token || userToken;

  // ---- POST /api/wallet/open-account ------------------------------------
  console.log('\nPOST /api/wallet/open-account');
  const opened = await req('POST', '/api/wallet/open-account', { token: userToken });
  check('open-account -> 200', opened.status === 200, `got ${opened.status} ${opened.text.slice(0, 120)}`);
  check('returns the wallet', Boolean(opened.json?.wallet));
  check('wallet has 8 services', opened.json?.wallet?.services?.length === 8,
    `got ${opened.json?.wallet?.services?.length}`);

  // ---- GET / PATCH /api/settings ---------------------------------------
  //
  // The সেটিংস screen's whole job is to remember two switches and a PIN, so the
  // assertion that matters is the round trip: flip, re-read, confirm the server
  // kept it. The PIN adds a sharper property — the response must prove a PIN
  // *exists* without ever carrying it, which is the entire point of storing a
  // salted hash rather than the digits.
  console.log('\nGET + PATCH /api/settings');
  const toBnDigits = (s: string) => s.replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

  const settingsBefore = await req('GET', '/api/settings', { token: userToken });
  check('GET /api/settings -> 200', settingsBefore.status === 200, `got ${settingsBefore.status}`);
  check('the view carries both general toggles as booleans',
    typeof settingsBefore.json?.decimalAmount === 'boolean' &&
      typeof settingsBefore.json?.notificationSound === 'boolean',
    JSON.stringify(settingsBefore.json));
  check('the view carries every label the screen renders',
    typeof settingsBefore.json?.decimalExample === 'string' &&
      typeof settingsBefore.json?.notificationSubtitle === 'string' &&
      typeof settingsBefore.json?.phoneLabel === 'string' &&
      typeof settingsBefore.json?.pinLabel === 'string',
    JSON.stringify(settingsBefore.json));
  // The client's hint text is rendered from these, so a rule change on the
  // server cannot leave the screen describing a PIN length it no longer accepts.
  check('the server publishes its own PIN rule',
    settingsBefore.json?.pinMin === 4 && settingsBefore.json?.pinMax === 6,
    `${settingsBefore.json?.pinMin}..${settingsBefore.json?.pinMax}`);

  const flipped = await req('PATCH', '/api/settings', {
    token: userToken,
    body: { decimalAmount: false, notificationSound: false },
  });
  check('PATCH /api/settings -> 200', flipped.status === 200, `got ${flipped.status}`);

  const settingsAfter = await req('GET', '/api/settings', { token: userToken });
  check('both toggles persisted',
    settingsAfter.json?.decimalAmount === false && settingsAfter.json?.notificationSound === false,
    JSON.stringify({ d: settingsAfter.json?.decimalAmount, n: settingsAfter.json?.notificationSound }));
  check('the decimal example follows the toggle off',
    settingsAfter.json?.decimalExample === 'উদাহরণঃ ১২,০০০',
    String(settingsAfter.json?.decimalExample));

  const badPin = await req('PATCH', '/api/settings', {
    token: userToken,
    body: { pin: '1234567' },
  });
  check('a PIN longer than the rule -> 400', badPin.status === 400, `got ${badPin.status}`);

  const pinSet = await req('PATCH', '/api/settings', {
    token: userToken,
    body: { pin: '৪৩২১' },
  });
  check('setting a PIN -> 200', pinSet.status === 200, `got ${pinSet.status}`);
  check('the response reports the PIN as set', pinSet.json?.pinSet === true,
    String(pinSet.json?.pinSet));
  check('the PIN row switches to পরিবর্তন', pinSet.json?.pinLabel === 'PIN পরিবর্তন করুন',
    String(pinSet.json?.pinLabel));
  check('the response never carries the PIN or its hash',
    !('pin' in (pinSet.json || {})) &&
      !('pinHash' in (pinSet.json || {})) &&
      !pinSet.text.includes('৪৩২১'),
    pinSet.text.slice(0, 160));

  const pinCleared = await req('PATCH', '/api/settings', {
    token: userToken,
    body: { pin: '' },
  });
  check('clearing the PIN -> pinSet false', pinCleared.json?.pinSet === false,
    String(pinCleared.json?.pinSet));

  // ---- মোবাইল নম্বর পরিবর্তন (PATCH /api/profile) -----------------------
  //
  // The number is the login credential, so "did the field change" is the weak
  // assertion. The strong one is that the new number actually signs in and the
  // old one stops working — and that a number another account owns is refused
  // instead of surfacing as a raw duplicate-key 500 from the unique index.
  console.log('\nমোবাইল নম্বর পরিবর্তন');
  const movedPhone = `+88013${String(Date.now()).slice(-8)}`;

  const badPhone = await req('PATCH', '/api/profile', {
    token: userToken,
    body: { phone: '12' },
  });
  check('an unusable phone number -> 400', badPhone.status === 400, `got ${badPhone.status}`);

  const takenPhone = await req('PATCH', '/api/profile', {
    token: userToken,
    body: { phone: ADMIN_PHONE },
  });
  check("another account's number -> 409", takenPhone.status === 409, `got ${takenPhone.status}`);

  const phoneChange = await req('PATCH', '/api/profile', {
    token: userToken,
    body: { phone: movedPhone },
  });
  check('changing the mobile number -> 200', phoneChange.status === 200, `got ${phoneChange.status}`);

  const afterPhone = await req('GET', '/api/settings', { token: userToken });
  check('the সেটিংস screen shows the new number',
    String(afterPhone.json?.phoneSubtitle || '').includes(toBnDigits(movedPhone)),
    String(afterPhone.json?.phoneSubtitle));

  const byNewPhone = await req('POST', '/api/auth/login', {
    body: { phone: movedPhone, password: USER_PASSWORD_2 },
  });
  check('the new number signs in -> 200', byNewPhone.status === 200, `got ${byNewPhone.status}`);

  const byOldPhone = await req('POST', '/api/auth/login', {
    body: { phone: USER_PHONE, password: USER_PASSWORD_2 },
  });
  check('the old number no longer signs in -> 401', byOldPhone.status === 401,
    `got ${byOldPhone.status}`);

  // ---- fixtures for the admin routes ------------------------------------
  const cust = await req('POST', '/api/customers', {
    token: userToken,
    body: { name: `কভারেজ কাস্টমার ${stamp}`, type: 'customer', note: 'মূল' },
  });
  customerId = cust.json?.customer?.id || '';
  check('fixture customer created', Boolean(customerId));

  const tx = await req('POST', `/api/customers/${customerId}/transactions`, {
    token: userToken,
    body: { kind: 'sale', amount: 100, description: 'কভারেজ' },
  });
  txId = tx.json?.entry?.id || '';
  check('fixture transaction created', Boolean(txId));

  const cash = await req('POST', '/api/cashbox/entries', {
    token: userToken,
    body: { kind: 'expense', amount: 50, description: 'কভারেজ খরচ' },
  });
  cashId = cash.json?.entry?.id || '';
  check('fixture cashbox entry created', Boolean(cashId));

  // ---- the admin lists must NOT be owner-scoped -------------------------
  // This is the entire point of the panel: a superadmin sees *every* user's
  // data, not just their own. Nothing else in the suite would catch a refactor
  // that quietly filtered these lists by the signed-in admin's own id — every
  // other assertion would still pass while the panel silently became useless.
  // By this point the throwaway account owns a customer and a transaction, and
  // the admin owns their own, so a correct list must span >= 2 distinct owners.
  console.log('\nGET /api/admin/customers  (must not be owner-scoped)');
  const allCust = await req('GET', '/api/admin/customers?limit=200', { token: adminToken });
  check('admin customer list -> 200', allCust.status === 200, `got ${allCust.status}`);
  const custItems: any[] = allCust.json?.items || [];
  check('admin customer list is non-empty', custItems.length > 0, `got ${custItems.length}`);
  check(
    "admin list includes the throwaway owner's own customer",
    custItems.some((x) => x.ownerId === userId),
    `no item with ownerId=${userId}`,
  );
  const custOwners = new Set(custItems.map((x) => x.ownerId));
  check(
    'admin customer list spans more than one owner (NOT owner-scoped)',
    custOwners.size > 1,
    `distinct owners: ${custOwners.size}`,
  );
  check(
    'admin customer list total is consistent with the page',
    typeof allCust.json?.total === 'number' && allCust.json.total >= custItems.length,
    `total ${allCust.json?.total} vs ${custItems.length} rows`,
  );

  // The balance the panel shows must equal the balance the owner sees.
  //
  // This is the assertion that catches the aggregation-casting trap: mongoose
  // casts `Model.find()` filters but NOT aggregation `$match`, so a 24-hex
  // *string* owner id matches nothing and every panel balance silently reads
  // ৳০.০০ while the owner-scoped screens show the real figures. Both views go
  // through the same `customerView`, so the only way they can differ is a
  // broken balance lookup.
  const mineList = await req('GET', '/api/customers', { token: userToken });
  const mineRow = (mineList.json?.items || []).find((x: any) => x.id === customerId);
  const panelRow = custItems.find((x: any) => x.id === customerId);

  check('the fixture customer is visible to its owner', Boolean(mineRow));
  check(
    "the panel's balance equals the owner-scoped balance (aggregation casting)",
    Boolean(mineRow && panelRow) &&
      panelRow.amountRaw === mineRow.amountRaw &&
      panelRow.amountTone === mineRow.amountTone,
    `panel=${panelRow?.amountDisplay}/${panelRow?.amountTone} ` +
      `owner=${mineRow?.amountDisplay}/${mineRow?.amountTone}`,
  );
  check(
    "the panel's balance is not silently zero",
    Boolean(panelRow) && Math.abs(panelRow.amountRaw) > 0.004,
    `panel amountRaw=${panelRow?.amountRaw}`,
  );

  console.log('\nGET /api/admin/transactions  (must not be owner-scoped)');
  const allTx = await req('GET', '/api/admin/transactions?limit=200', { token: adminToken });
  check('admin transaction list -> 200', allTx.status === 200, `got ${allTx.status}`);
  const txItems: any[] = allTx.json?.items || [];
  check(
    "admin list includes the throwaway owner's transaction",
    txItems.some((x) => x.ownerId === userId),
    `no item with ownerId=${userId}`,
  );
  const txOwners = new Set(txItems.map((x) => x.ownerId));
  check(
    'admin transaction list spans more than one owner (NOT owner-scoped)',
    txOwners.size > 1,
    `distinct owners: ${txOwners.size}`,
  );
  check(
    'every admin transaction row carries owner attribution',
    txItems.length > 0 && txItems.every((x) => x.ownerId && x.ownerName),
  );

  // ---- GET /api/admin/customers/:id  (the spread-collision regression) ---
  console.log('\nGET /api/admin/customers/:id');
  const detail = await req('GET', `/api/admin/customers/${customerId}`, { token: adminToken });
  check('admin customer detail -> 200', detail.status === 200, `got ${detail.status}`);
  const c = detail.json?.customer;

  // This is the regression test for the `...ownerOf()` collision: the owner's
  // fields must NOT overwrite the customer's own.
  check('customer.id is the CUSTOMER id, not the owner id', c?.id === customerId, `got ${c?.id}`);
  check('customer.name is the customer name', c?.name === `কভারেজ কাস্টমার ${stamp}`, `got "${c?.name}"`);
  check('customer.phone is not the owner phone', c?.phone !== ADMIN_PHONE, `got "${c?.phone}"`);
  check('ownerId is namespaced and correct', c?.ownerId === userId, `got ${c?.ownerId}`);
  check('ownerName is the owner name', c?.ownerName === USER_NAME, `got "${c?.ownerName}"`);
  check('ownerPhone is the owner phone', c?.ownerPhone === USER_PHONE, `got "${c?.ownerPhone}"`);
  check('hasPhoto present', c?.hasPhoto === false, `got ${c?.hasPhoto}`);
  check('createdAt present', typeof c?.createdAt === 'string');
  check('ledger entries returned', Array.isArray(detail.json?.entries) && detail.json.entries.length === 1);
  check('headline returned', typeof detail.json?.headline?.label === 'string');

  // ---- PATCH / DELETE /api/admin/customers/:id --------------------------
  console.log('\nPATCH + DELETE /api/admin/customers/:id');
  const renamed = await req('PATCH', `/api/admin/customers/${customerId}`, {
    token: adminToken,
    body: { name: `কভারেজ সম্পাদিত ${stamp}`, note: 'সম্পাদিত' },
  });
  check('admin PATCH customer -> 200', renamed.status === 200, `got ${renamed.status}`);
  const reRead = await req('GET', `/api/admin/customers/${customerId}`, { token: adminToken });
  check('admin rename persisted', reRead.json?.customer?.name === `কভারেজ সম্পাদিত ${stamp}`,
    `got "${reRead.json?.customer?.name}"`);
  check('initials recomputed', reRead.json?.customer?.initials !== c?.initials);

  // ---- GET / PATCH /api/admin/users/:id ---------------------------------
  console.log('\nGET + PATCH /api/admin/users/:id');
  const userDetail = await req('GET', `/api/admin/users/${userId}`, { token: adminToken });
  check('admin user detail -> 200', userDetail.status === 200, `got ${userDetail.status}`);
  check('user detail has profile', Boolean(userDetail.json?.profile));
  check('user detail has wallet', Boolean(userDetail.json?.wallet));
  check('user detail has summary', Boolean(userDetail.json?.summary));
  check('user detail has counts', Boolean(userDetail.json?.counts));
  check('user detail reports the customer count', userDetail.json?.counts?.customers === 1,
    `got ${userDetail.json?.counts?.customers}`);

  const renamedUser = await req('PATCH', `/api/admin/users/${userId}`, {
    token: adminToken,
    body: { name: `${USER_NAME} (admin edited)` },
  });
  check('admin PATCH user -> 200', renamedUser.status === 200, `got ${renamedUser.status}`);
  const userReRead = await req('GET', `/api/admin/users/${userId}`, { token: adminToken });
  check('admin user rename persisted', userReRead.json?.user?.name === `${USER_NAME} (admin edited)`,
    `got "${userReRead.json?.user?.name}"`);

  // ---- মাল্টি ব্যবসা (X-Business-Id) ------------------------------------
  //
  // Two things need proving here that smoke.ts only asserts structurally:
  //   1. the header really scopes reads and writes, and
  //   2. the *admin* routes deliberately do NOT honour it — the panel exists to
  //      see a shopkeeper's whole footprint, across every book they keep.
  console.log('\nমাল্টি ব্যবসা (X-Business-Id)');
  const bizList = await req('GET', '/api/businesses', { token: userToken });
  check('GET /api/businesses -> 200', bizList.status === 200, `got ${bizList.status}`);
  const primaryBiz: string = bizList.json?.items?.[0]?.id || '';
  check('the throwaway account has a primary book', Boolean(primaryBiz));

  const bizCreated = await req('POST', '/api/businesses', {
    token: userToken,
    body: { name: 'কভারেজ বই ২' },
  });
  check('POST /api/businesses -> 201', bizCreated.status === 201, `got ${bizCreated.status}`);
  businessId = bizCreated.json?.business?.id || '';

  const secondBookCustomer = await req('POST', '/api/customers', {
    token: userToken,
    headers: { 'X-Business-Id': businessId },
    body: { name: `বই২ কাস্টমার ${stamp}`, phone: '01799999999', type: 'customer' },
  });
  check('create a customer in the second book -> 201',
    secondBookCustomer.status === 201, `got ${secondBookCustomer.status}`);
  const secondCustomerId: string = secondBookCustomer.json?.customer?.id || '';

  // The admin panel must span every book. `counts` and `summary` come from the
  // whole-account scope (`business: null`), not from whichever book the header
  // happened to name — if that regressed, the panel would silently under-report.
  const adminUser = await req('GET', `/api/admin/users/${userId}`, { token: adminToken });
  check('admin sees a whole-account customer count',
    (adminUser.json?.counts?.customers ?? 0) >= 2,
    `saw ${adminUser.json?.counts?.customers}`);
  check('admin summary spans every book, not one',
    (adminUser.json?.summary?.customerCount ?? 0) >= 2,
    `saw ${adminUser.json?.summary?.customerCount}`);

  const adminCustomers = await req(
    'GET',
    `/api/admin/customers?q=${encodeURIComponent(stamp)}&limit=50`,
    { token: adminToken },
  );
  const adminNames: string[] = ((adminCustomers.json?.items ?? []) as any[]).map((c) =>
    String(c.name),
  );
  check('admin lists customers from both books',
    adminNames.some((n) => n.includes(stamp)) && adminNames.includes(`বই২ কাস্টমার ${stamp}`),
    adminNames.join(' | '));

  // Rename through the override the Android client actually uses.
  const bizRenamed = await req('POST', `/api/businesses/${businessId}`, {
    token: userToken,
    headers: { 'X-HTTP-Method-Override': 'PATCH' },
    body: { name: 'কভারেজ বই ২ (নতুন)' },
  });
  check('POST + X-HTTP-Method-Override renames -> 200',
    bizRenamed.status === 200, `got ${bizRenamed.status}`);
  const bizReread = await req('GET', '/api/businesses', { token: userToken });
  check('the rename persisted',
    (bizReread.json?.items ?? []).some(
      (b: any) => b.id === businessId && b.name === 'কভারেজ বই ২ (নতুন)',
    ));

  // A book belongs to one account and no other — the admin's token included.
  const foreignPatch = await req('POST', `/api/businesses/${businessId}`, {
    token: adminToken,
    headers: { 'X-HTTP-Method-Override': 'PATCH' },
    body: { name: 'চুরি' },
  });
  check("another account cannot rename someone else's book -> 404",
    foreignPatch.status === 404, `got ${foreignPatch.status}`);

  const bizDeleted = await req('DELETE', `/api/businesses/${businessId}`, { token: userToken });
  check('DELETE /api/businesses/:id -> 200', bizDeleted.status === 200, `got ${bizDeleted.status}`);
  check("the cascade removed the second book's customer",
    bizDeleted.json?.removed?.customers === 1, JSON.stringify(bizDeleted.json?.removed));
  check('the second book\'s customer is really gone',
    (await req('GET', `/api/customers/${secondCustomerId}`, {
      token: userToken,
      headers: { 'X-Business-Id': primaryBiz },
    })).status === 404);

  const primaryAfter = await req('GET', '/api/customers', {
    token: userToken,
    headers: { 'X-Business-Id': primaryBiz },
  });
  check('the primary book kept its own customers',
    (primaryAfter.json?.items ?? []).length >= 1,
    `saw ${(primaryAfter.json?.items ?? []).length}`);

  // Cleared, so cleanup does not try to delete it a second time.
  businessId = '';

  // ---- GET /api/admin/businesses ----------------------------------------
  //
  // The panel's job is to see *every* account's books, so the property that
  // matters is that this list spans more than one owner. On a single-account
  // fixture it would pass whether or not it filtered by the caller.
  console.log('\nGET /api/admin/businesses');
  const bizAdmin = await req('GET', '/api/admin/businesses?limit=100', { token: adminToken });
  check('admin business list -> 200', bizAdmin.status === 200, `got ${bizAdmin.status}`);
  const bizRows: any[] = bizAdmin.json?.items ?? [];
  check('admin business list is not empty', bizRows.length > 0, `saw ${bizRows.length}`);
  check(
    'admin business list spans more than one owner (NOT owner-scoped)',
    new Set(bizRows.map((b) => b.ownerId)).size > 1,
    `owners=${new Set(bizRows.map((b) => b.ownerId)).size}`,
  );
  check(
    "the throwaway account's book is visible to the admin",
    bizRows.some((b) => b.ownerId === userId),
  );
  check(
    'each row carries its owner and per-book tallies',
    bizRows.every(
      (b) =>
        b.ownerName &&
        typeof b.customerCount === 'number' &&
        typeof b.transactionCount === 'number' &&
        b.receivable &&
        typeof b.receivable.display === 'string',
    ),
  );

  const bizAsUser = await req('GET', '/api/admin/businesses', { token: userToken });
  check('a plain user gets 403 from the admin business list', bizAsUser.status === 403,
    `got ${bizAsUser.status}`);

  // The admin path must honour the same invariant as the owner path. After the
  // section above the throwaway account is down to one book, so its last book
  // is the right target.
  const lastBookId: string = bizRows.find((b) => b.ownerId === userId)?.id || '';
  if (lastBookId) {
    const adminLastDelete = await req('DELETE', `/api/admin/businesses/${lastBookId}`, {
      token: adminToken,
    });
    check("admin cannot delete an account's last book -> 409",
      adminLastDelete.status === 409, `got ${adminLastDelete.status}`);
  }

  // A second book, so the admin cascade can be exercised for real.
  const spare = await req('POST', '/api/businesses', {
    token: userToken,
    body: { name: 'অ্যাডমিন ক্যাসকেড বই' },
  });
  const spareId: string = spare.json?.business?.id || '';
  const spareCustomer = await req('POST', '/api/customers', {
    token: userToken,
    headers: { 'X-Business-Id': spareId },
    body: { name: `অ্যাডমিন ক্যাসকেড ${stamp}`, type: 'customer' },
  });
  check('a book with a customer, for the admin cascade -> 201',
    spareCustomer.status === 201, `got ${spareCustomer.status}`);

  const adminRename = await req('PATCH', `/api/admin/businesses/${spareId}`, {
    token: adminToken,
    body: { name: 'অ্যাডমিন নাম' },
  });
  check('admin PATCH business -> 200', adminRename.status === 200, `got ${adminRename.status}`);
  check('admin rename persisted', adminRename.json?.business?.name === 'অ্যাডমিন নাম',
    `got ${adminRename.json?.business?.name}`);

  const adminDelete = await req('DELETE', `/api/admin/businesses/${spareId}`, {
    token: adminToken,
  });
  check('admin DELETE business -> 200', adminDelete.status === 200, `got ${adminDelete.status}`);
  check(
    "admin delete cascaded the book's customer (same cascade as the owner path)",
    adminDelete.json?.removed?.customers === 1,
    JSON.stringify(adminDelete.json?.removed),
  );

  // ---- GET /api/admin/endpoints -----------------------------------------
  console.log('\nGET /api/admin/endpoints');
  const cat = await req('GET', '/api/admin/endpoints', { token: adminToken });
  check('catalogue -> 200', cat.status === 200, `got ${cat.status}`);
  // Derived from the module rather than hard-coded, so adding a route can never
  // leave this assertion quietly wrong the way a literal "48" did.
  check(
    `catalogue lists all ${ENDPOINTS.length} endpoints`,
    cat.json?.endpoints?.length === ENDPOINTS.length,
    `got ${cat.json?.endpoints?.length}, expected ${ENDPOINTS.length}`,
  );
  check(
    'the served catalogue matches the module exactly',
    JSON.stringify((cat.json?.endpoints ?? []).map((e: any) => `${e.method} ${e.path}`)) ===
      JSON.stringify(ENDPOINTS.map((e) => `${e.method} ${e.path}`)),
    'served order/content differs from lib/endpoints.ts',
  );
  check('catalogue entries carry method + path',
    Array.isArray(cat.json?.endpoints) && cat.json.endpoints.every((e: any) => e.method && e.path));

  // ---- PATCH / DELETE /api/admin/transactions/:id -----------------------
  console.log('\nPATCH + DELETE /api/admin/transactions/:id');
  const txPatched = await req('PATCH', `/api/admin/transactions/${txId}`, {
    token: adminToken,
    body: { amount: 175.5, description: 'সংশোধিত' },
  });
  check('admin PATCH transaction -> 200', txPatched.status === 200, `got ${txPatched.status}`);
  check('transaction amount corrected', txPatched.json?.entry?.amountRaw === 175.5,
    `got ${txPatched.json?.entry?.amountRaw}`);
  // PATCH returns { ok, entry, balance }; only DELETE returns the customer.
  check('recomputed balance returned', txPatched.json?.balance?.receivable === 175.5,
    `got ${JSON.stringify(txPatched.json?.balance)}`);

  const txDel = await req('DELETE', `/api/admin/transactions/${txId}`, { token: adminToken });
  check('admin DELETE transaction -> 200', txDel.status === 200, `got ${txDel.status}`);
  const txGone = await req('GET', `/api/customers/${customerId}/transactions`, { token: userToken });
  check('transaction really gone',
    !(txGone.json?.items || []).some((e: any) => e.id === txId));
  if (txDel.status === 200) txId = '';

  // ---- PATCH / DELETE /api/admin/cashbox/:id ----------------------------
  console.log('\nPATCH + DELETE /api/admin/cashbox/:id');
  const cashPatched = await req('PATCH', `/api/admin/cashbox/${cashId}`, {
    token: adminToken,
    body: { amount: 99, description: 'সংশোধিত খরচ' },
  });
  check('admin PATCH cashbox -> 200', cashPatched.status === 200, `got ${cashPatched.status}`);
  const cashReRead = await req('GET', '/api/admin/cashbox?limit=50', { token: adminToken });
  const found = (cashReRead.json?.items || []).find((e: any) => e.id === cashId);
  check('cashbox amount corrected', found?.amount === 99, `got ${found?.amount}`);

  const cashDel = await req('DELETE', `/api/admin/cashbox/${cashId}`, { token: adminToken });
  check('admin DELETE cashbox -> 200', cashDel.status === 200, `got ${cashDel.status}`);
  const cashAfter = await req('GET', '/api/admin/cashbox?limit=50', { token: adminToken });
  check('cashbox entry really gone', !(cashAfter.json?.items || []).some((e: any) => e.id === cashId));
  if (cashDel.status === 200) cashId = '';

  // ---- DELETE /api/uploads/:publicId  (the path form) -------------------
  console.log('\nDELETE /api/uploads/:publicId');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );
  const up = await req('POST', '/api/uploads', {
    token: userToken,
    body: { data: `data:image/png;base64,${png.toString('base64')}`, mime: 'image/png' },
  });
  check('upload for the path form -> 201', up.status === 201, `got ${up.status} ${up.text.slice(0, 120)}`);
  uploadPublicId = up.json?.publicId || '';
  uploadUrl = up.json?.url || '';

  // The path form only works for a single-segment id; the query form is the
  // general one. Both must refuse another owner's asset.
  const pathDel = await req('DELETE', `/api/uploads/${encodeURIComponent(uploadPublicId)}`, {
    token: userToken,
  });
  check('DELETE /api/uploads/:publicId -> 200', pathDel.status === 200,
    `got ${pathDel.status} ${pathDel.text.slice(0, 140)}`);
  check('destroy reported ok', pathDel.json?.removed === true, JSON.stringify(pathDel.json));
  if (pathDel.status === 200) uploadPublicId = '';

  // ---- DELETE /api/admin/customers/:id ----------------------------------
  console.log('\nDELETE /api/admin/customers/:id');
  const custDel = await req('DELETE', `/api/admin/customers/${customerId}`, { token: adminToken });
  check('admin DELETE customer -> 200', custDel.status === 200, `got ${custDel.status}`);
  const custGone = await req('GET', `/api/admin/customers/${customerId}`, { token: adminToken });
  check('customer really gone', custGone.status === 404, `got ${custGone.status}`);
  if (custDel.status === 200) customerId = '';

  console.log('\n' + '\u2500'.repeat(52));
  console.log(`  passed: ${pass}`);
  console.log(`  failed: ${fail}`);
  console.log('\u2500'.repeat(52) + '\n');
}

async function cleanup() {
  // Delete the throwaway account and cascade whatever it still owns.
  if (uploadPublicId) {
    await req('DELETE', `/api/uploads?publicId=${encodeURIComponent(uploadPublicId)}`, {
      token: userToken,
    }).catch(() => {});
  }
  if (cashId) {
    await req('DELETE', `/api/admin/cashbox/${cashId}`, { token: adminToken }).catch(() => {});
  }
  // Only still set if the মাল্টি ব্যবসা section threw partway through.
  if (businessId) {
    await req('DELETE', `/api/businesses/${businessId}`, { token: userToken }).catch(() => {});
  }
  if (txId) {
    await req('DELETE', `/api/admin/transactions/${txId}`, { token: adminToken }).catch(() => {});
  }
  if (customerId) {
    await req('DELETE', `/api/admin/customers/${customerId}`, { token: adminToken }).catch(() => {});
  }
  if (userId) {
    await req('DELETE', `/api/admin/users/${userId}`, { token: adminToken }).catch(() => {});
  }
}

main()
  .catch((err) => {
    console.error('api-coverage crashed:', err);
    fail += 1;
  })
  .finally(async () => {
    await cleanup();
    void uploadUrl;
    process.exit(fail === 0 ? 0 : 1);
  });
