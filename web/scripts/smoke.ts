import './env';
import { ENDPOINTS } from '../lib/endpoints';

/**
 * End-to-end smoke test against a running server.
 *
 *   npm run smoke            (server must already be up on :4000)
 *
 * Two kinds of check:
 *
 *   1. Behavioural — login (wrong + right), bearer auth, the full customer /
 *      transaction / cashbox CRUD round-trip, validation, role enforcement.
 *   2. Route existence — walks every entry in lib/endpoints.ts and proves the
 *      path is actually registered in the Next.js app:
 *        · GET entries are fetched (with real ids substituted) and must not 404.
 *        · Non-GET entries get a verb the route does *not* export, so Next
 *          answers 405. A 405 proves the path exists without mutating data.
 *
 * Every row it creates is deleted again, and the customer count is compared
 * before and after so a leak would fail the run.
 */

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4000';
const USER_PHONE = process.env.SMOKE_PHONE || '+8801706617723';
const USER_PASSWORD = process.env.SMOKE_PASSWORD || '123456';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

interface Res {
  status: number;
  json: any;
  text: string;
  cookie: string | null;
}

async function req(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    token?: string | null;
    cookie?: string | null;
    /** X-Business-Id — which of the account's books (মাল্টি ব্যবসা) to act on. */
    business?: string | null;
    /** Send this as POST + X-HTTP-Method-Override, the way the Android client does. */
    override?: string;
  } = {},
): Promise<Res> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.business) headers['X-Business-Id'] = opts.business;
  if (opts.override) headers['X-HTTP-Method-Override'] = opts.override;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: 'manual',
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json (e.g. an HTML redirect page) */
  }

  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : null;

  return { status: res.status, json, text, cookie };
}

const section = (t: string) => console.log(`\n${t}`);

async function main() {
  console.log(`\nTallyKhata Next.js smoke test`);
  console.log(`target: ${BASE}\n`);

  // ---- 1. system ---------------------------------------------------------
  section('System');
  const health = await req('GET', '/api/health');
  check('GET /api/health -> 200', health.status === 200, `got ${health.status}`);
  check('health.ok is true', health.json?.ok === true, JSON.stringify(health.json));
  check('health.runtime is nextjs', health.json?.runtime === 'nextjs');

  const upStatus = await req('GET', '/api/uploads/status');
  check('GET /api/uploads/status -> 200', upStatus.status === 200);
  check('uploads.configured is true', upStatus.json?.configured === true);

  // ---- 2. auth -----------------------------------------------------------
  section('Auth');
  const badLogin = await req('POST', '/api/auth/login', {
    body: { phone: USER_PHONE, password: 'definitely-wrong' },
  });
  check('login with wrong password -> 401', badLogin.status === 401, `got ${badLogin.status}`);

  const login = await req('POST', '/api/auth/login', {
    body: { phone: USER_PHONE, password: USER_PASSWORD },
  });
  check('login -> 200', login.status === 200, `got ${login.status}`);
  const token: string | null = login.json?.token ?? null;
  check('login returns a token', typeof token === 'string' && token.length > 20);
  check('login returns the user', Boolean(login.json?.user?.id));
  check('login sets the session cookie', Boolean(login.cookie));

  const meNoAuth = await req('GET', '/api/auth/me');
  check('GET /api/auth/me without credentials -> 401', meNoAuth.status === 401);

  const me = await req('GET', '/api/auth/me', { token });
  check('GET /api/auth/me with bearer -> 200', me.status === 200, `got ${me.status}`);
  check('me returns the same user id', me.json?.user?.id === login.json?.user?.id);

  const badRegister = await req('POST', '/api/auth/register', {
    body: { name: '', phone: '123', password: 'x' },
  });
  check('register with bad input -> 400', badRegister.status === 400, `got ${badRegister.status}`);
  check('validation error carries details', Array.isArray(badRegister.json?.details));

  // ---- 3. app shell ------------------------------------------------------
  section('App shell');
  const bootstrap = await req('GET', '/api/bootstrap', { token });
  check('GET /api/bootstrap -> 200', bootstrap.status === 200, `got ${bootstrap.status}`);
  check('bootstrap has profile + summary + wallet + menu',
    Boolean(bootstrap.json?.profile && bootstrap.json?.summary && bootstrap.json?.wallet && bootstrap.json?.menu));

  for (const p of ['/api/profile', '/api/settings', '/api/summary', '/api/wallet', '/api/menu', '/api/reports/summary?days=30']) {
    const r = await req('GET', p, { token });
    check(`GET ${p} -> 200`, r.status === 200, `got ${r.status}`);
  }

  const summaryBefore = await req('GET', '/api/summary', { token });
  const txBefore = summaryBefore.json?.transactionCount ?? 0;

  // ---- 4. customers + ledger CRUD ---------------------------------------
  section('Customers & ledger');
  const list = await req('GET', '/api/customers', { token });
  check('GET /api/customers -> 200', list.status === 200, `got ${list.status}`);
  const baseline = Array.isArray(list.json?.items) ? list.json.items.length : -1;
  check('customer list is an array', baseline >= 0);

  const emptyName = await req('POST', '/api/customers', { token, body: { name: '  ' } });
  check('POST /api/customers with empty name -> 400', emptyName.status === 400, `got ${emptyName.status}`);

  const created = await req('POST', '/api/customers', {
    token,
    body: { name: 'স্মোক টেস্ট কাস্টমার', phone: '01711111111', type: 'customer', note: 'স্বয়ংক্রিয় পরীক্ষা' },
  });
  check('POST /api/customers -> 201', created.status === 201, `got ${created.status}`);
  const customerId: string = created.json?.customer?.id;
  check('created customer has an id', typeof customerId === 'string');
  check('created customer keeps the বিবরণ note', created.json?.customer?.note === 'স্বয়ংক্রিয় পরীক্ষা');
  check('new customer starts at zero', created.json?.customer?.amountTone === 'zero');

  const one = await req('GET', `/api/customers/${customerId}`, { token });
  check('GET /api/customers/:id -> 200', one.status === 200, `got ${one.status}`);
  check('ledger screen has headline + entries',
    Boolean(one.json?.headline && Array.isArray(one.json?.entries)));

  // The Android client sends PATCH as POST + X-HTTP-Method-Override.
  const overridden = await req('POST', `/api/customers/${customerId}`, {
    token,
    body: { note: 'বিবরণ হালনাগাদ' },
  });
  // Plain POST on this path is not the PATCH alias (no header), so it must 404 —
  // which itself proves the override header is what routes it to PATCH.
  check('POST without the override header -> 404', overridden.status === 404, `got ${overridden.status}`);

  const patched = await (async () => {
    const res = await fetch(`${BASE}/api/customers/${customerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-HTTP-Method-Override': 'PATCH',
      },
      body: JSON.stringify({ note: 'বিবরণ হালনাগাদ' }),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  })();
  check('POST + X-HTTP-Method-Override: PATCH -> 200', patched.status === 200, `got ${patched.status}`);
  check('override PATCH applied the note', patched.json?.customer?.note === 'বিবরণ হালনাগাদ');

  const tx = await req('POST', `/api/customers/${customerId}/transactions`, {
    token,
    body: { box: 'gave', amount: '১,২৫০.৫০', description: 'স্মোক বেচা' },
  });
  check('POST transaction (Bengali digits) -> 201', tx.status === 201, `got ${tx.status}`);
  check('Bengali amount parsed to 1250.5', tx.json?.entry?.amountRaw === 1250.5,
    `got ${tx.json?.entry?.amountRaw}`);
  check('customer now reads পাবো', tx.json?.customer?.amountTone === 'pabo');
  check('headline label is পাবো', tx.json?.headline?.label === 'পাবো');

  const badAmount = await req('POST', `/api/customers/${customerId}/transactions`, {
    token,
    body: { box: 'gave', amount: 0 },
  });
  check('transaction with zero amount -> 400', badAmount.status === 400, `got ${badAmount.status}`);

  const entries = await req('GET', `/api/customers/${customerId}/transactions`, { token });
  check('GET customer transactions -> 200', entries.status === 200);
  check('transaction list has the new entry', entries.json?.items?.length === 1);

  // ---- 5. cashbox --------------------------------------------------------
  section('Cash box');
  const dash = await req('GET', '/api/cashbox', { token });
  check('GET /api/cashbox -> 200', dash.status === 200, `got ${dash.status}`);
  check('dashboard has five rows', dash.json?.rows?.length === 5);

  const cashEntriesBefore = await req('GET', '/api/cashbox/entries?limit=500', { token });
  const cashBaseline = cashEntriesBefore.json?.items?.length ?? -1;

  const cash = await req('POST', '/api/cashbox/entries', {
    token,
    body: { kind: 'expense', amount: 250, description: 'স্মোক খরচ', category: 'পরীক্ষা' },
  });
  check('POST /api/cashbox/entries -> 201', cash.status === 201, `got ${cash.status}`);
  const cashId: string = cash.json?.entry?.id;
  check('cash entry returns the dashboard', Boolean(cash.json?.dashboard?.currentCash));

  const badKind = await req('POST', '/api/cashbox/entries', {
    token,
    body: { kind: 'not_a_kind', amount: 10 },
  });
  check('cashbox with bad kind -> 400', badKind.status === 400, `got ${badKind.status}`);

  const cashDel = await req('DELETE', `/api/cashbox/entries/${cashId}`, { token });
  check('DELETE /api/cashbox/entries/:id -> 200', cashDel.status === 200, `got ${cashDel.status}`);

  const cashEntriesAfter = await req('GET', '/api/cashbox/entries?limit=500', { token });
  check('cashbox entry count restored',
    cashEntriesAfter.json?.items?.length === cashBaseline,
    `${cashEntriesAfter.json?.items?.length} vs ${cashBaseline}`);

  // ---- 6. per-user isolation --------------------------------------------
  section('Per-user isolation');
  const otherLogin = await req('POST', '/api/auth/register', {
    body: {
      name: 'স্মোক আইসোলেশন',
      phone: `017${Date.now().toString().slice(-8)}`,
      password: 'test123456',
    },
  });
  check('register a throwaway account -> 201', otherLogin.status === 201, `got ${otherLogin.status}`);
  const otherToken: string | null = otherLogin.json?.token ?? null;

  if (otherToken) {
    const otherList = await req('GET', '/api/customers', { token: otherToken });
    check('new account sees an empty book', otherList.json?.items?.length === 0,
      `saw ${otherList.json?.items?.length}`);

    const crossRead = await req('GET', `/api/customers/${customerId}`, { token: otherToken });
    check("another user cannot read someone else's customer -> 404", crossRead.status === 404,
      `got ${crossRead.status}`);

    const crossDelete = await req('DELETE', `/api/customers/${customerId}`, { token: otherToken });
    check("another user cannot delete someone else's customer -> 404", crossDelete.status === 404,
      `got ${crossDelete.status}`);
  }

  // ---- 6b. multi-business (মাল্টি ব্যবসা) --------------------------------
  //
  // Every document now also carries a `business`, so a book must be at least as
  // sealed as an account is. These checks mirror the cross-owner pair above and
  // run on the throwaway account, so nothing they create outlives the run.
  section('Multi-business');
  if (otherToken) {
    const listed = await req('GET', '/api/businesses', { token: otherToken });
    check('GET /api/businesses -> 200', listed.status === 200, `got ${listed.status}`);
    check('a brand-new account is auto-provisioned one book',
      listed.json?.items?.length === 1, `saw ${listed.json?.items?.length}`);
    check('the first book is the primary', listed.json?.items?.[0]?.isPrimary === true);
    check('the sheet header reads ব্যবসা সমূহ (১/৫)',
      listed.json?.label === 'ব্যবসা সমূহ (১/৫)', String(listed.json?.label));
    check('the cap is five', listed.json?.max === 5, String(listed.json?.max));
    check('each row carries both subtitle halves',
      typeof listed.json?.items?.[0]?.customerLabel === 'string' &&
        typeof listed.json?.items?.[0]?.receivableLabel === 'string',
      JSON.stringify(listed.json?.items?.[0]));

    const primaryId: string = listed.json?.items?.[0]?.id ?? '';

    const created = await req('POST', '/api/businesses', {
      token: otherToken,
      body: { name: 'দ্বিতীয় ব্যবসা' },
    });
    check('POST /api/businesses -> 201', created.status === 201, `got ${created.status}`);
    const secondId: string = created.json?.business?.id ?? '';
    check('the added book is not primary', created.json?.business?.isPrimary === false);

    // Rename, both ways: real PATCH, and the POST + override the app uses.
    const renamed = await req('PATCH', `/api/businesses/${secondId}`, {
      token: otherToken,
      body: { name: 'নতুন নাম' },
    });
    check('PATCH /api/businesses/:id renames -> 200',
      renamed.status === 200 && renamed.json?.business?.name === 'নতুন নাম',
      `got ${renamed.status} ${renamed.json?.business?.name}`);
    const overridden = await req('POST', `/api/businesses/${secondId}`, {
      token: otherToken,
      override: 'PATCH',
      body: { name: 'ওভাররাইড নাম' },
    });
    check('POST + X-HTTP-Method-Override renames too -> 200',
      overridden.status === 200 && overridden.json?.business?.name === 'ওভাররাইড নাম',
      `got ${overridden.status} ${overridden.json?.business?.name}`);

    // One customer in each book.
    const inSecond = await req('POST', '/api/customers', {
      token: otherToken,
      business: secondId,
      body: { name: 'বই-২ কাস্টমার', phone: '01711111111', type: 'customer' },
    });
    check('create a customer in the second book -> 201',
      inSecond.status === 201, `got ${inSecond.status}`);
    const secondCustomerId: string = inSecond.json?.customer?.id ?? '';

    const inPrimary = await req('POST', '/api/customers', {
      token: otherToken,
      business: primaryId,
      body: { name: 'বই-১ কাস্টমার', phone: '01722222222', type: 'customer' },
    });
    check('create a customer in the primary book -> 201',
      inPrimary.status === 201, `got ${inPrimary.status}`);

    const namesIn = async (opts: { business?: string | null }) =>
      ((await req('GET', '/api/customers', { token: otherToken, ...opts })).json?.items ?? [])
        .map((i: any) => String(i.name));

    const book2 = await namesIn({ business: secondId });
    check('book 2 lists only its own customer',
      book2.includes('বই-২ কাস্টমার') && !book2.includes('বই-১ কাস্টমার'), book2.join(' | '));

    const book1 = await namesIn({ business: primaryId });
    check('book 1 lists only its own customer',
      book1.includes('বই-১ কাস্টমার') && !book1.includes('বই-২ কাস্টমার'), book1.join(' | '));

    // The backward-compatibility promise: an APK built before multi-business
    // sends no header at all, and must land on the primary book.
    const noHeader = await namesIn({});
    check('no X-Business-Id falls back to the primary book',
      noHeader.includes('বই-১ কাস্টমার') && !noHeader.includes('বই-২ কাস্টমার'),
      noHeader.join(' | '));

    // A book must not be able to reach into another book, exactly as one
    // account cannot reach into another.
    const crossBookRead = await req('GET', `/api/customers/${secondCustomerId}`, {
      token: otherToken,
      business: primaryId,
    });
    check("one book cannot read another book's customer -> 404",
      crossBookRead.status === 404, `got ${crossBookRead.status}`);
    const crossBookDelete = await req('DELETE', `/api/customers/${secondCustomerId}`, {
      token: otherToken,
      business: primaryId,
    });
    check("one book cannot delete another book's customer -> 404",
      crossBookDelete.status === 404, `got ${crossBookDelete.status}`);

    const sum1 = await req('GET', '/api/summary', { token: otherToken, business: primaryId });
    const sum2 = await req('GET', '/api/summary', { token: otherToken, business: secondId });
    check('each book totals only its own customers',
      sum1.json?.customerCount === 1 && sum2.json?.customerCount === 1,
      `primary=${sum1.json?.customerCount} second=${sum2.json?.customerCount}`);

    // A business id that does not belong to the caller is reported as missing,
    // not forbidden — otherwise the response would confirm which ids exist.
    const foreign = await req('GET', '/api/customers', {
      token: otherToken,
      business: '0'.repeat(24),
    });
    check('an unknown business id -> 404', foreign.status === 404, `got ${foreign.status}`);

    // Fill to the cap, then prove the sixth is refused by the server (the sheet
    // hides the button, but the cap has to hold regardless of the client).
    const filler: string[] = [];
    for (let n = 3; n <= 5; n += 1) {
      const r = await req('POST', '/api/businesses', {
        token: otherToken,
        body: { name: `বই ${n}` },
      });
      if (r.status === 201) filler.push(String(r.json?.business?.id));
    }
    const over = await req('POST', '/api/businesses', {
      token: otherToken,
      body: { name: 'বই ৬' },
    });
    check('a sixth business is refused -> 409', over.status === 409, `got ${over.status}`);

    const atCap = await req('GET', '/api/businesses', { token: otherToken });
    check('the account is capped at five',
      atCap.json?.items?.length === 5, `saw ${atCap.json?.items?.length}`);
    check('the header tracks the count',
      atCap.json?.label === 'ব্যবসা সমূহ (৫/৫)', String(atCap.json?.label));

    // Deleting a book takes its contents with it and leaves the rest alone.
    const removed = await req('DELETE', `/api/businesses/${secondId}`, { token: otherToken });
    check('DELETE /api/businesses/:id -> 200', removed.status === 200, `got ${removed.status}`);
    check('the deleted book took its own customer with it',
      removed.json?.removed?.customers === 1, JSON.stringify(removed.json?.removed));
    const survivor = await namesIn({ business: primaryId });
    check('the other book is untouched by the cascade',
      survivor.includes('বই-১ কাস্টমার'), survivor.join(' | '));

    // Drain back to one book, then prove the last one is protected: without it
    // `resolveBusiness` would have nothing to fall back to and every screen
    // would 404.
    for (const id of filler) {
      await req('DELETE', `/api/businesses/${id}`, { token: otherToken });
    }
    const drained = await req('GET', '/api/businesses', { token: otherToken });
    check('draining the extras leaves exactly one book',
      drained.json?.items?.length === 1, `saw ${drained.json?.items?.length}`);
    const lastDelete = await req('DELETE', `/api/businesses/${primaryId}`, {
      token: otherToken,
    });
    check('the last book cannot be deleted -> 409',
      lastDelete.status === 409, `got ${lastDelete.status}`);
  }

  // ---- 6c. stock (স্টক হিসাব) -------------------------------------------
  //
  // Quantities are *derived* (openingStock + Σin − Σout), so the interesting
  // assertion is not "did the write land" but "does the derived number actually
  // track the movements". A stored running total would pass the former and still
  // be wrong — which is exactly the failure this design exists to rule out.
  section('Stock');
  {
    const stockBefore = await req('GET', '/api/stock', { token });
    check('GET /api/stock -> 200', stockBefore.status === 200, `got ${stockBefore.status}`);
    const stockBaseline: number = stockBefore.json?.items?.length ?? -1;
    check('the stock list carries a summary alongside the rows',
      typeof stockBefore.json?.summary?.itemCount === 'number',
      JSON.stringify(stockBefore.json?.summary));

    const name = `স্মোক পণ্য ${Date.now().toString().slice(-6)}`;
    const createdItem = await req('POST', '/api/stock', {
      token,
      body: {
        name,
        unit: 'কেজি',
        purchasePrice: 100,
        salePrice: 130,
        openingStock: 10,
        lowStockThreshold: 8,
      },
    });
    check('POST /api/stock -> 201', createdItem.status === 201, `got ${createdItem.status}`);
    const itemId: string = createdItem.json?.item?.id ?? '';

    check("a new item's quantity is its opening stock",
      createdItem.json?.item?.quantity === 10, String(createdItem.json?.item?.quantity));
    check('the quantity label is Bengali and carries the unit',
      createdItem.json?.item?.quantityLabel === 'স্টক: ১০ কেজি',
      String(createdItem.json?.item?.quantityLabel));
    check('cost value is quantity × purchase price',
      createdItem.json?.item?.costValue === 1000, String(createdItem.json?.item?.costValue));
    check('a new item starts above its threshold',
      createdItem.json?.item?.lowStock === false,
      String(createdItem.json?.item?.lowStock));

    const dup = await req('POST', '/api/stock', { token, body: { name } });
    check('a duplicate name in the same book -> 409', dup.status === 409, `got ${dup.status}`);

    const inbound = await req('POST', `/api/stock/${itemId}/movements`, {
      token,
      body: { direction: 'in', quantity: 5, unitCost: 100, note: 'নতুন মাল' },
    });
    check('POST /api/stock/:id/movements -> 201', inbound.status === 201, `got ${inbound.status}`);
    check('an in-movement raises the derived quantity',
      inbound.json?.item?.quantity === 15, String(inbound.json?.item?.quantity));
    check('the movement carries a Bengali title',
      inbound.json?.movement?.title === 'স্টক ইন ৫ কেজি',
      String(inbound.json?.movement?.title));

    const outbound = await req('POST', `/api/stock/${itemId}/movements`, {
      token,
      body: { direction: 'out', quantity: 7, note: 'বিক্রয়' },
    });
    check('an out-movement lowers the derived quantity',
      outbound.json?.item?.quantity === 8, String(outbound.json?.item?.quantity));
    check('reaching the threshold raises the low-stock flag',
      outbound.json?.item?.lowStock === true && outbound.json?.item?.lowStockLabel === 'স্টক কম',
      JSON.stringify({
        flag: outbound.json?.item?.lowStock,
        label: outbound.json?.item?.lowStockLabel,
      }));

    const zeroMove = await req('POST', `/api/stock/${itemId}/movements`, {
      token,
      body: { direction: 'in', quantity: 0 },
    });
    check('a zero-quantity movement -> 400', zeroMove.status === 400, `got ${zeroMove.status}`);

    const detail = await req('GET', `/api/stock/${itemId}`, { token });
    check('GET /api/stock/:id -> 200', detail.status === 200, `got ${detail.status}`);
    check('the movement history is newest first',
      detail.json?.movements?.length === 2 && detail.json?.movements?.[0]?.direction === 'out',
      JSON.stringify(detail.json?.movements?.map((m: { direction: string }) => m.direction)));

    const patched = await req('POST', `/api/stock/${itemId}`, {
      token,
      override: 'PATCH',
      body: { salePrice: 150 },
    });
    check('PATCH via POST + override -> 200', patched.status === 200, `got ${patched.status}`);
    check('PATCH applied the new sale price', patched.json?.item?.salePrice === 150,
      String(patched.json?.item?.salePrice));
    check('PATCH left the untouched fields alone',
      patched.json?.item?.note === '' && patched.json?.item?.quantity === 8,
      JSON.stringify({ note: patched.json?.item?.note, qty: patched.json?.item?.quantity }));

    // A book must be at least as sealed as an account is. These mirror the
    // cross-owner pair above and run on the throwaway account.
    if (otherToken) {
      const crossGet = await req('GET', `/api/stock/${itemId}`, { token: otherToken });
      check("another user cannot read someone else's stock item -> 404",
        crossGet.status === 404, `got ${crossGet.status}`);
      const crossMove = await req('POST', `/api/stock/${itemId}/movements`, {
        token: otherToken,
        body: { direction: 'in', quantity: 1 },
      });
      check("another user cannot move someone else's stock -> 404",
        crossMove.status === 404, `got ${crossMove.status}`);
      const crossDelete = await req('DELETE', `/api/stock/${itemId}`, { token: otherToken });
      check("another user cannot delete someone else's stock item -> 404",
        crossDelete.status === 404, `got ${crossDelete.status}`);
    }

    const delStock = await req('DELETE', `/api/stock/${itemId}`, { token });
    check('DELETE /api/stock/:id -> 200', delStock.status === 200, `got ${delStock.status}`);
    check('the delete cascaded the movement history',
      delStock.json?.removed?.movements === 2, String(delStock.json?.removed?.movements));

    const stockAfter = await req('GET', '/api/stock', { token });
    check('stock count restored', stockAfter.json?.items?.length === stockBaseline,
      `${stockAfter.json?.items?.length} vs ${stockBaseline}`);
  }

  // ---- 6d. settings (সেটিংস) --------------------------------------------
  //
  // The সেটিংস row in the drawer rendered perfectly and did nothing: its key
  // reached `AppRoot`'s click handler and fell through `else -> Unit`. These
  // checks cover the API half of that defect — a screen can only be as real as
  // the endpoint behind it. Everything runs on the throwaway account, so the
  // admin's own preferences, PIN and phone number are never touched by a run.
  section('Settings');
  if (otherToken) {
    const initial = await req('GET', '/api/settings', { token: otherToken });
    check('GET /api/settings -> 200', initial.status === 200, `got ${initial.status}`);
    check('both general toggles default to on',
      initial.json?.decimalAmount === true && initial.json?.notificationSound === true,
      JSON.stringify({ d: initial.json?.decimalAmount, n: initial.json?.notificationSound }));
    check('a fresh account has no PIN', initial.json?.pinSet === false,
      String(initial.json?.pinSet));
    check('the decimal example shows paisa while the toggle is on',
      initial.json?.decimalExample === 'উদাহরণঃ ১২,০০০.০০', String(initial.json?.decimalExample));
    check('the PIN row offers to set one',
      initial.json?.pinLabel === 'PIN সেট করুন', String(initial.json?.pinLabel));

    const off = await req('PATCH', '/api/settings', {
      token: otherToken,
      body: { decimalAmount: false },
    });
    check('PATCH /api/settings -> 200', off.status === 200, `got ${off.status}`);
    check('the decimal example drops the paisa with the toggle',
      off.json?.decimalExample === 'উদাহরণঃ ১২,০০০', String(off.json?.decimalExample));

    const reread = await req('GET', '/api/settings', { token: otherToken });
    check('the toggle persisted', reread.json?.decimalAmount === false,
      String(reread.json?.decimalAmount));
    // A partial PATCH must not clobber the key it never mentioned — the app
    // flips one toggle per request, so this is the shape it actually sends.
    check('flipping one toggle left the other alone',
      reread.json?.notificationSound === true, String(reread.json?.notificationSound));

    const sound = await req('POST', '/api/settings', {
      token: otherToken,
      override: 'PATCH',
      body: { notificationSound: false },
    });
    check('POST + X-HTTP-Method-Override flips a toggle too -> 200',
      sound.status === 200 && sound.json?.notificationSound === false,
      `got ${sound.status} ${sound.json?.notificationSound}`);

    const plainPost = await req('POST', '/api/settings', {
      token: otherToken,
      body: { notificationSound: true },
    });
    check('plain POST on /api/settings -> 404', plainPost.status === 404,
      `got ${plainPost.status}`);

    const badPin = await req('PATCH', '/api/settings', {
      token: otherToken,
      body: { pin: 'ab' },
    });
    check('a non-numeric PIN -> 400', badPin.status === 400, `got ${badPin.status}`);

    const pin = await req('PATCH', '/api/settings', {
      token: otherToken,
      body: { pin: '১২৩৪' },
    });
    check('a Bengali-digit PIN is accepted -> 200', pin.status === 200, `got ${pin.status}`);
    check('the PIN row switches to পরিবর্তন', pin.json?.pinLabel === 'PIN পরিবর্তন করুন',
      String(pin.json?.pinLabel));
    // The whole point of hashing: the caller learns *that* a PIN exists, never
    // what it is. A response echoing the PIN would make the hash pointless.
    check('the PIN is never echoed back',
      !('pin' in (pin.json || {})) &&
        !('pinHash' in (pin.json || {})) &&
        !pin.text.includes('১২৩৪'),
      pin.text.slice(0, 160));

    const cleared = await req('PATCH', '/api/settings', {
      token: otherToken,
      body: { pin: '' },
    });
    check('an empty PIN clears it', cleared.json?.pinSet === false, String(cleared.json?.pinSet));

    // মোবাইল নম্বর পরিবর্তন. The number *is* the login credential, so the check
    // that matters is not "did the field change" but "does the new number sign
    // in" — and that a number another account already owns is refused rather
    // than surfacing as a raw duplicate-key 500 from the unique index.
    const toBnDigits = (s: string) => s.replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
    const newPhone = `+88019${String(Date.now()).slice(-8)}`;

    const badPhone = await req('PATCH', '/api/profile', {
      token: otherToken,
      body: { phone: '12' },
    });
    check('an unusable phone number -> 400', badPhone.status === 400, `got ${badPhone.status}`);

    const takenPhone = await req('PATCH', '/api/profile', {
      token: otherToken,
      body: { phone: USER_PHONE },
    });
    check("another account's number -> 409", takenPhone.status === 409, `got ${takenPhone.status}`);

    const moved = await req('PATCH', '/api/profile', {
      token: otherToken,
      body: { phone: newPhone },
    });
    check('changing the mobile number -> 200', moved.status === 200, `got ${moved.status}`);

    const afterPhone = await req('GET', '/api/settings', { token: otherToken });
    check('the সেটিংস screen shows the new number',
      String(afterPhone.json?.phoneSubtitle || '').includes(toBnDigits(newPhone)),
      String(afterPhone.json?.phoneSubtitle));

    const relogin = await req('POST', '/api/auth/login', {
      body: { phone: newPhone, password: 'test123456' },
    });
    check('the new number is the credential now -> 200', relogin.status === 200,
      `got ${relogin.status}`);
    const staleLogin = await req('POST', '/api/auth/login', {
      body: { phone: USER_PHONE, password: 'test123456' },
    });
    check('the old number no longer signs in -> 401', staleLogin.status === 401,
      `got ${staleLogin.status}`);
  }

  // ---- 7. admin panel ----------------------------------------------------
  section('Admin panel');
  const adminBad = await req('POST', '/api/admin/login', {
    body: { phone: USER_PHONE, password: 'wrong' },
  });
  check('admin login with wrong password -> 401', adminBad.status === 401, `got ${adminBad.status}`);

  const adminLogin = await req('POST', '/api/admin/login', {
    body: { phone: USER_PHONE, password: USER_PASSWORD },
  });
  check('admin login -> 200', adminLogin.status === 200, `got ${adminLogin.status}`);
  const adminCookie = adminLogin.cookie;
  check('admin login sets the session cookie', Boolean(adminCookie));
  check('admin login does NOT return a bearer token', adminLogin.json?.token === undefined);

  const adminStatsNoAuth = await req('GET', '/api/admin/stats');
  check('GET /api/admin/stats without a cookie -> 401', adminStatsNoAuth.status === 401,
    `got ${adminStatsNoAuth.status}`);

  // A signed-in *shopkeeper* must not reach the panel. The throwaway account
  // registered in the isolation section is a genuine non-admin, so its token is
  // the right credential here — reusing the admin's bearer token would pass
  // even if the role check were broken.
  if (otherToken) {
    const asUser = await req('GET', '/api/admin/stats', { token: otherToken });
    check('GET /api/admin/stats as a plain user -> 403', asUser.status === 403,
      `got ${asUser.status}`);
    const asUserWrite = await req('DELETE', `/api/admin/users/${login.json?.user?.id}`, {
      token: otherToken,
    });
    check('non-admin cannot DELETE an account -> 403', asUserWrite.status === 403,
      `got ${asUserWrite.status}`);
  }

  // Sweep *every* admin-protected endpoint from the catalogue, not a sample.
  // Only two routes were covered above; the other 15 — including
  // PATCH /api/admin/users/:id, which can grant `role: admin` — had no test at
  // all, so a refactor that dropped requireAdmin() from one handler would have
  // passed the whole suite. Driving the sweep from ENDPOINTS means a new admin
  // route is covered on the day it is added, with nothing to remember.
  if (otherToken) {
    const fakeId = 'ffffffffffffffffffffffff';
    const guarded = ENDPOINTS.filter((e) => e.auth === 'admin');
    const leaked: string[] = [];
    for (const e of guarded) {
      const p = e.path.split('?')[0].replace(':id', fakeId);
      const r = await req(e.method, p, { token: otherToken });
      // The guard must reject *before* any resource lookup, so a non-existent id
      // still yields 403 — never a 404 (guard not first) and never a 2xx (hole).
      if (r.status !== 403) leaked.push(`${e.method} ${p} -> ${r.status}`);
    }
    check(
      `all ${guarded.length} catalogue 'admin' endpoints refuse a plain user`,
      leaked.length === 0,
      leaked.join('; '),
    );
    check(
      'the admin sweep covers the whole catalogue group',
      guarded.length >= 17,
      `only ${guarded.length} admin-guarded entries found`,
    );
    const first = await req('GET', '/api/admin/me', { token: otherToken });
    check(
      'the refusal is a FORBIDDEN envelope with a Bengali message',
      first.json?.error === 'FORBIDDEN' && /[\u0980-\u09FF]/.test(first.json?.message || ''),
      `got ${first.json?.error} / ${first.json?.message}`,
    );
  }

  const stats = await req('GET', '/api/admin/stats', { cookie: adminCookie });
  check('GET /api/admin/stats with the cookie -> 200', stats.status === 200, `got ${stats.status}`);
  check('stats reports users.total > 0', (stats.json?.users?.total ?? 0) > 0);
  check('stats reports customers.total > 0', (stats.json?.customers?.total ?? 0) > 0);

  for (const p of [
    '/api/admin/me',
    '/api/admin/users?limit=5',
    '/api/admin/customers?limit=5',
    '/api/admin/transactions?limit=5',
    '/api/admin/cashbox?limit=5',
  ]) {
    const r = await req('GET', p, { cookie: adminCookie });
    check(`GET ${p} -> 200`, r.status === 200, `got ${r.status}`);
  }

  const usersList = await req('GET', '/api/admin/users?limit=50', { cookie: adminCookie });
  check('admin user list is paginated', typeof usersList.json?.pages === 'number');

  // ---- 8. route existence -----------------------------------------------
  section(`Route existence (${ENDPOINTS.length} catalogue entries)`);

  /*
   * A 404 from a GET is ambiguous: it can mean "no such route" or "route is
   * fine, that record does not exist". So registration is proved with a verb
   * the route deliberately does NOT export — Next answers 405 when the path is
   * registered and 404 when it is not. That is resource-independent and, unlike
   * a real DELETE, cannot touch any data.
   */
  const probePath = (path: string) =>
    path.split('?')[0].replace(':publicId', 'probe').replace(':id', 'probe');

  let missing = 0;
  for (const ep of ENDPOINTS) {
    const r = await req('PUT', probePath(ep.path), { token, cookie: adminCookie });
    if (r.status !== 405) {
      missing += 1;
      check(`route registered: ${ep.method} ${ep.path}`, false, `PUT probe gave ${r.status}`);
    }
  }
  check(
    `all ${ENDPOINTS.length} catalogue routes are registered`,
    missing === 0,
    `${missing} missing`,
  );

  // Every GET with no path parameter should answer 200 for a caller holding
  // both credentials, which exercises each handler's happy path.
  const paramlessGets = ENDPOINTS.filter((e) => e.method === 'GET' && !e.path.includes(':'));
  let badGets = 0;
  for (const ep of paramlessGets) {
    const r = await req('GET', ep.path, { token, cookie: adminCookie });
    if (r.status !== 200) {
      badGets += 1;
      check(`GET ${ep.path} -> 200`, false, `got ${r.status}`);
    }
  }
  check(`all ${paramlessGets.length} parameterless GETs -> 200`, badGets === 0, `${badGets} bad`);

  // And one real admin write, to prove the mutating admin routes are wired.
  const adminTx = await req('PATCH', `/api/admin/transactions/${tx.json?.entry?.id}`, {
    cookie: adminCookie,
    body: { description: 'অ্যাডমিন সংশোধন' },
  });
  check('PATCH /api/admin/transactions/:id -> 200', adminTx.status === 200, `got ${adminTx.status}`);
  check('admin PATCH applied', adminTx.json?.entry?.description === 'অ্যাডমিন সংশোধন');
  check('admin PATCH returns the recomputed balance', Boolean(adminTx.json?.balance));

  // ---- 9. cleanup --------------------------------------------------------
  section('Cleanup');
  const del = await req('DELETE', `/api/customers/${customerId}`, { token });
  check('DELETE /api/customers/:id -> 200', del.status === 200, `got ${del.status}`);

  const after = await req('GET', '/api/customers', { token });
  check('customer count restored', after.json?.items?.length === baseline,
    `${after.json?.items?.length} vs ${baseline}`);

  const summaryAfter = await req('GET', '/api/summary', { token });
  check('transaction count restored',
    summaryAfter.json?.transactionCount === txBefore,
    `${summaryAfter.json?.transactionCount} vs ${txBefore}`);

  if (otherToken) {
    const meOther = await req('GET', '/api/auth/me', { token: otherToken });
    const otherId = meOther.json?.user?.id;
    if (otherId) {
      const removed = await req('DELETE', `/api/admin/users/${otherId}`, { cookie: adminCookie });
      check('throwaway account cleaned up', removed.status === 200, `got ${removed.status}`);
    }
  }

  // ---- 10. logout --------------------------------------------------------
  section('Logout');
  const logout = await req('POST', '/api/auth/logout', { token });
  check('POST /api/auth/logout -> 200', logout.status === 200, `got ${logout.status}`);
  const afterLogout = await req('GET', '/api/auth/me', { token });
  check('token is dead after logout -> 401', afterLogout.status === 401, `got ${afterLogout.status}`);

  const adminLogout = await req('POST', '/api/admin/logout', { cookie: adminCookie });
  check('POST /api/admin/logout -> 200', adminLogout.status === 200, `got ${adminLogout.status}`);

  // ---- summary -----------------------------------------------------------
  console.log('\n' + '─'.repeat(52));
  console.log(`  passed: ${pass}`);
  console.log(`  failed: ${fail}`);
  if (fail) {
    console.log('\n  failures:');
    failures.forEach((f) => console.log(`    · ${f}`));
  }
  console.log('─'.repeat(52) + '\n');

  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[smoke] crashed:', err);
  process.exit(1);
});
