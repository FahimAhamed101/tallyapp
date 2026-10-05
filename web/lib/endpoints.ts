/**
 * The API catalogue.
 *
 * One source of truth for every route this Next.js app exposes, used by:
 *   - GET /api/admin/endpoints   (machine-readable JSON)
 *   - /admin/endpoints           (the panel's API explorer page)
 *   - the smoke script           (asserts every entry actually responds)
 *
 * `auth` is the guard the handler enforces, not documentation prose:
 *   'public'  — no credentials
 *   'bearer'  — Android app: Authorization: Bearer <token>
 *   'session' — any logged-in user via cookie or bearer
 *   'admin'   — cookie/bearer AND role === 'admin'
 */

export type AuthLevel = 'public' | 'bearer' | 'session' | 'admin';

export interface EndpointDef {
  /** HTTP verb, or the verb the caller *means* (see `alias`). */
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth: AuthLevel;
  group: 'system' | 'auth' | 'uploads' | 'app' | 'customers' | 'cashbox' | 'admin';
  summary: string;
  /** True when POST also serves PATCH via X-HTTP-Method-Override. */
  alias?: boolean;
  params?: string;
  body?: string;
  returns?: string;
}

export const ENDPOINTS: EndpointDef[] = [
  // ---- system -------------------------------------------------------------
  {
    method: 'GET',
    path: '/api/health',
    auth: 'public',
    group: 'system',
    summary: 'DB connection health and uptime',
    returns: '{ ok, db, database, host, uptimeSeconds, runtime }',
  },

  // ---- auth ---------------------------------------------------------------
  {
    method: 'POST',
    path: '/api/auth/register',
    auth: 'public',
    group: 'auth',
    summary: 'Create a shopkeeper account and its profile + wallet',
    body: '{ name, phone, password }',
    returns: '{ token, user }',
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    auth: 'public',
    group: 'auth',
    summary: 'Phone + password login; also sets the panel cookie',
    body: '{ phone, password }',
    returns: '{ token, user }',
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    auth: 'bearer',
    group: 'auth',
    summary: 'Cold-start check: is this token still valid?',
    returns: '{ user }',
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    auth: 'bearer',
    group: 'auth',
    summary: 'Revoke only the calling device session',
    returns: '{ ok }',
  },
  {
    method: 'POST',
    path: '/api/auth/password',
    auth: 'bearer',
    group: 'auth',
    summary: 'Change password, keeping the caller signed in',
    body: '{ currentPassword, newPassword }',
    returns: '{ ok }',
  },

  // ---- uploads ------------------------------------------------------------
  {
    method: 'GET',
    path: '/api/uploads/status',
    auth: 'public',
    group: 'uploads',
    summary: 'Is Cloudinary configured? Max image bytes',
    returns: '{ configured, maxBytes }',
  },
  {
    method: 'POST',
    path: '/api/uploads',
    auth: 'session',
    group: 'uploads',
    summary: 'Upload a base64 image; returns the Cloudinary URL',
    body: '{ data, mime?, folder?, publicId?, tags? }',
    returns: '{ ok, url, publicId, width, height, bytes, format }',
  },
  {
    method: 'DELETE',
    path: '/api/uploads?publicId=',
    auth: 'session',
    group: 'uploads',
    summary: 'Delete an uploaded image (query form — public_id has slashes)',
    params: 'publicId',
    returns: '{ ok, removed }',
  },
  {
    method: 'DELETE',
    path: '/api/uploads/:publicId',
    auth: 'session',
    group: 'uploads',
    summary: 'Delete an uploaded image (single-segment path form)',
    params: 'publicId',
    returns: '{ ok, removed }',
  },

  // ---- app shell ----------------------------------------------------------
  {
    method: 'GET',
    path: '/api/profile',
    auth: 'session',
    group: 'app',
    summary: 'Shop profile shown in the gold toolbar',
    returns: '{ id, name, phone, initials, ... }',
  },
  {
    method: 'PATCH',
    path: '/api/profile',
    auth: 'session',
    group: 'app',
    summary: 'Edit the shop profile',
    alias: true,
    body: '{ name?, phone?, initials?, photoUrl?, goldPlanName?, ... }',
    returns: 'profile',
  },
  {
    method: 'GET',
    path: '/api/summary',
    auth: 'session',
    group: 'app',
    summary: 'Home-tab headline totals (পাবো / দেবো)',
    returns: '{ receivable, payable, customerCount, ... }',
  },
  {
    method: 'GET',
    path: '/api/wallet',
    auth: 'session',
    group: 'app',
    summary: 'ওয়ালেট tab: balance, service grid, benefits',
    returns: '{ id, balance, accountOpened, services, benefits }',
  },
  {
    method: 'POST',
    path: '/api/wallet/open-account',
    auth: 'session',
    group: 'app',
    summary: 'টালিপে একাউন্ট খুলুন — enables every wallet service',
    returns: '{ ok, wallet }',
  },
  {
    method: 'GET',
    path: '/api/menu',
    auth: 'session',
    group: 'app',
    summary: 'Drawer sections and their counters',
    returns: '{ sections, version, profile }',
  },
  {
    method: 'GET',
    path: '/api/bootstrap',
    auth: 'session',
    group: 'app',
    summary: 'One call that fills the home tab on cold start',
    returns: '{ user, profile, summary, wallet, menu }',
  },
  {
    method: 'GET',
    path: '/api/reports/summary?days=30',
    auth: 'session',
    group: 'app',
    summary: 'The রিপোর্ট pill: period totals',
    params: 'days',
    returns: '{ days, range, sales, purchases, expenses, ... }',
  },

  // ---- customers ----------------------------------------------------------
  {
    method: 'GET',
    path: '/api/customers?q=&type=',
    auth: 'session',
    group: 'customers',
    summary: 'Home list with derived balances',
    params: 'q, type',
    returns: '{ items: CustomerView[] }',
  },
  {
    method: 'POST',
    path: '/api/customers',
    auth: 'session',
    group: 'customers',
    summary: 'নতুন কাস্টমার/সাপ্লায়ার',
    body: '{ name, phone?, type?, note?, photoUrl?, photoPublicId? }',
    returns: '{ customer }',
  },
  {
    method: 'GET',
    path: '/api/customers/:id',
    auth: 'session',
    group: 'customers',
    summary: 'Ledger screen: customer, headline and all entries',
    params: 'id',
    returns: '{ customer, headline, entries }',
  },
  {
    method: 'PATCH',
    path: '/api/customers/:id',
    auth: 'session',
    group: 'customers',
    summary: 'Edit name / phone / type / বিবরণ / photo',
    alias: true,
    params: 'id',
    body: '{ name?, phone?, type?, note?, photoUrl?, photoPublicId? }',
    returns: '{ customer }',
  },
  {
    method: 'DELETE',
    path: '/api/customers/:id',
    auth: 'session',
    group: 'customers',
    summary: 'Delete the customer and their whole ledger',
    params: 'id',
    returns: '{ ok, deletedId }',
  },
  {
    method: 'GET',
    path: '/api/customers/:id/transactions',
    auth: 'session',
    group: 'customers',
    summary: 'The ledger entries for one customer',
    params: 'id',
    returns: '{ items }',
  },
  {
    method: 'POST',
    path: '/api/customers/:id/transactions',
    auth: 'session',
    group: 'customers',
    summary: 'দিলাম/বেচা + পেলাম form',
    params: 'id',
    body: "{ box: 'gave'|'got', amount, description?, date?, hasPhoto? }",
    returns: '{ ok, entry, customer, headline }',
  },

  // ---- cashbox ------------------------------------------------------------
  {
    method: 'GET',
    path: '/api/cashbox',
    auth: 'session',
    group: 'cashbox',
    summary: 'ক্যাশবক্স dashboard',
    returns: '{ todaySale, currentCash, todayIn, todayOut, rows }',
  },
  {
    method: 'GET',
    path: '/api/cashbox/entries?kind=&limit=',
    auth: 'session',
    group: 'cashbox',
    summary: 'Cash-box entry list',
    params: 'kind, limit',
    returns: '{ items }',
  },
  {
    method: 'POST',
    path: '/api/cashbox/entries',
    auth: 'session',
    group: 'cashbox',
    summary: 'ক্যাশ বেচা / খরচ / মালিক দিল / মালিক নিল',
    body: '{ kind, amount, description?, category?, date?, hasPhoto? }',
    returns: '{ ok, entry, dashboard }',
  },
  {
    method: 'DELETE',
    path: '/api/cashbox/entries/:id',
    auth: 'session',
    group: 'cashbox',
    summary: 'Delete a cash-box entry',
    params: 'id',
    returns: '{ ok, deletedId, dashboard }',
  },

  // ---- admin --------------------------------------------------------------
  {
    method: 'POST',
    path: '/api/admin/login',
    auth: 'public',
    group: 'admin',
    summary: 'Panel sign-in; refuses non-admin accounts',
    body: '{ phone, password }',
    returns: '{ ok, user } + cookie',
  },
  {
    method: 'POST',
    path: '/api/admin/logout',
    auth: 'session',
    group: 'admin',
    summary: 'Panel sign-out',
    returns: '{ ok }',
  },
  {
    method: 'GET',
    path: '/api/admin/me',
    auth: 'admin',
    group: 'admin',
    summary: 'Who the panel is signed in as',
    returns: '{ user }',
  },
  {
    method: 'GET',
    path: '/api/admin/stats',
    auth: 'admin',
    group: 'admin',
    summary: 'Platform-wide totals for the dashboard',
    returns: '{ users, customers, transactions, cashbox, photos }',
  },
  {
    method: 'GET',
    path: '/api/admin/users?q=&role=&page=&limit=',
    auth: 'admin',
    group: 'admin',
    summary: 'All accounts with per-user row counters',
    params: 'q, role, page, limit',
    returns: '{ items, total, page, pages }',
  },
  {
    method: 'GET',
    path: '/api/admin/users/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'One account: profile, wallet, totals, recent ledger',
    params: 'id',
    returns: '{ user, profile, wallet, summary, counts, recentTransactions }',
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Rename, re-phone, promote/demote or disable an account',
    params: 'id',
    body: '{ name?, phone?, role?, disabled?, photoUrl? }',
    returns: '{ ok, user }',
  },
  {
    method: 'DELETE',
    path: '/api/admin/users/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Delete an account and cascade everything it owns',
    params: 'id',
    returns: '{ ok, deletedId, removed }',
  },
  {
    method: 'GET',
    path: '/api/admin/customers?q=&type=&owner=&page=&limit=',
    auth: 'admin',
    group: 'admin',
    summary: 'Every customer/supplier across all accounts',
    params: 'q, type, owner, page, limit',
    returns: '{ items, total, page, pages }',
  },
  {
    method: 'GET',
    path: '/api/admin/customers/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'One customer with their full ledger (not owner-scoped)',
    params: 'id',
    returns: '{ customer, headline, entries }',
  },
  {
    method: 'PATCH',
    path: '/api/admin/customers/:id',
    auth: 'admin',
    group: 'admin',
    summary: "Edit any account's customer",
    params: 'id',
    body: '{ name?, phone?, type?, note?, photoUrl?, photoPublicId? }',
    returns: '{ customer }',
  },
  {
    method: 'DELETE',
    path: '/api/admin/customers/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Delete any customer and their ledger',
    params: 'id',
    returns: '{ ok, deletedId, removedTransactions }',
  },
  {
    method: 'GET',
    path: '/api/admin/transactions?q=&kind=&owner=&from=&to=&page=&limit=',
    auth: 'admin',
    group: 'admin',
    summary: 'The full cross-account ledger',
    params: 'q, kind, owner, from, to, page, limit',
    returns: '{ items, total, page, pages }',
  },
  {
    method: 'PATCH',
    path: '/api/admin/transactions/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Correct a mis-keyed ledger entry',
    params: 'id',
    body: '{ kind?, amount?, description?, hasPhoto?, date? }',
    returns: '{ ok, entry, balance }',
  },
  {
    method: 'DELETE',
    path: '/api/admin/transactions/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Delete a ledger entry and recompute the balance',
    params: 'id',
    returns: '{ ok, deletedId, customer }',
  },
  {
    method: 'GET',
    path: '/api/admin/cashbox?kind=&owner=&q=&page=&limit=',
    auth: 'admin',
    group: 'admin',
    summary: 'Every cash-box movement across all accounts',
    params: 'kind, owner, q, page, limit',
    returns: '{ items, total, page, pages }',
  },
  {
    method: 'PATCH',
    path: '/api/admin/cashbox/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Correct a cash-box entry',
    params: 'id',
    body: '{ kind?, amount?, description?, category?, hasPhoto?, date? }',
    returns: '{ ok, entry, dashboard }',
  },
  {
    method: 'DELETE',
    path: '/api/admin/cashbox/:id',
    auth: 'admin',
    group: 'admin',
    summary: 'Delete a cash-box entry',
    params: 'id',
    returns: '{ ok, deletedId, dashboard }',
  },
  {
    method: 'GET',
    path: '/api/admin/endpoints',
    auth: 'admin',
    group: 'admin',
    summary: 'This catalogue, as JSON',
    returns: '{ count, groups, endpoints }',
  },
];

export const GROUP_LABELS: Record<EndpointDef['group'], string> = {
  system: 'System',
  auth: 'Authentication',
  uploads: 'Image uploads',
  app: 'App shell',
  customers: 'Customers & ledger',
  cashbox: 'Cash box',
  admin: 'Superadmin',
};

export const AUTH_LABELS: Record<AuthLevel, string> = {
  public: 'Public',
  bearer: 'Bearer token',
  session: 'Logged in',
  admin: 'Admin only',
};
