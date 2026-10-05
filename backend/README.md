# TallyKhata backend

> **Superseded — see [`../web/`](../web/README.md).**
> This Express server has been ported to Next.js 14 App Router route handlers,
> plus a superadmin panel built with RTK Query. The port keeps every path, JSON
> envelope and Bengali string identical, reads and writes the same Atlas `tally`
> database, and listens on the same port **4000**, so the Android app needs no
> change at all.
>
> Both listen on 4000 — run one or the other, not both. The Express version is
> kept here as the reference implementation the port was verified against.

Node.js / Express + MongoDB Atlas API that backs the TallyKhata Android clone.
Every screen in the app reads from here; every form writes here. No fake data
remains in the client.

Accounts are keyed by **phone number**, and every collection is scoped to an
`owner` — two users on the same server never see each other's books.

```
backend/
├── .env                  Mongo + Cloudinary + auth config (see "Configuration")
├── package.json          deps + scripts
├── public/index.html     live browser preview of the same payloads (with login)
├── src/
│   ├── index.js          Express bootstrap: cors, json, verb-override, logger, routes, errors
│   ├── db.js             Mongo connection + the c-ares DNS fix
│   ├── seed.js           idempotent demo data (two accounts)
│   ├── ping.js           standalone connection prover
│   ├── models/           User, Profile, Customer, Transaction, CashboxEntry, Wallet
│   ├── lib/              auth, cloudinary, bengali, ledger (balance engine), summary, http
│   └── routes/           auth.js, uploads.js, app.js, customers.js, cashbox.js
├── smoke.js              quick end-to-end test
└── verify.js             full 86-check verification of every endpoint
```

## Running it

```bash
cd backend
npm install          # first time only
npm run seed:fresh   # two demo accounts with full books
npm start            # http://0.0.0.0:4000
```

Seeded logins — the app asks for a phone number and a password:

| phone | password | who |
|---|---|---|
| `01706617723` | `123456` | fahim — 6 customers, 10 txns, 12 cashbox entries |
| `01811223344` | `123456` | করিম — 2 customers, 3 txns, 3 cashbox entries |

`01706617723`, `+8801706617723`, `8801706617723`, `০১৭০৬৬১৭৭২৩` and
`+8801706617723` are all the same account: `lib/User.normalizePhone` collapses
them to one canonical `+8801XXXXXXXXX` before lookup.

Then open **http://127.0.0.1:4000/** — a browser page that logs in, then renders
the exact payloads the Android app receives, with working write forms and a live
request log. This is how the backend gets verified when no phone is attached.

### Scripts

| command | what it does |
|---|---|
| `npm start` | run the API |
| `npm run dev` | run with `--watch` (auto-restart) |
| `npm run seed` | seed only missing collections |
| `npm run seed:fresh` | wipe and re-seed |
| `npm run ping` | prove the Atlas connection, list collections |
| `npm run smoke` | quick end-to-end test |
| `npm run verify` | 86-check full-surface verification |

All scripts work from any working directory — `.env` is loaded relative to the
source file, not the process CWD.

## Configuration

`backend/.env`:

```
MONGODB_URI=mongodb+srv://admin:admin@cluster0.7khaz.mongodb.net/tally
PORT=4000

CLOUDINARY_CLOUD_NAME=fahim1213456
CLOUDINARY_API_KEY=554889398149233
CLOUDINARY_API_SECRET=xOh9Pctuw1UhBuRrj_XuP79ubbA
CLOUDINARY_FOLDER=tallykhata

AUTH_TOKEN_TTL_DAYS=90
```

Optional:

- `DNS_SERVERS=10.0.0.1,8.8.8.8` — override the resolvers used for the SRV lookup.

**The Cloudinary secret never leaves the server.** The app posts a base64 data
URI to `/api/uploads` and receives only the resulting `https://` URL.

### Why the DNS override exists

On this machine Node's c-ares resolver reports `127.0.0.1`, which refuses SRV
queries, so `mongodb+srv://` fails with:

```
querySrv ECONNREFUSED _mongodb._tcp.cluster0.7khaz.mongodb.net
```

…even though the OS resolver handles the record fine (`nslookup -type=SRV` works).
`src/db.js` points c-ares at public resolvers before the driver looks up the SRV
record, guarded on the `mongodb+srv://` scheme so a plain `mongodb://` URI is
untouched. An exported `MONGODB_URI` still wins over `.env`.

## Data model

Balances are **never stored**. `lib/ledger.js` derives them from the transaction
log in a single `$group` aggregation, so no form can leave a stale total:

```
receivable = sale − refund − payment_received
payable    = purchase − payment_made
```

`lib/summary.js` counts only net-positive customers toward পাবো and net-negative
toward দেবো, with a `> 0.004` tolerance so floating-point dust never shows a
customer as owing ০.০০১.

Transaction kinds and how a form maps to them:

| form | customer | supplier |
|---|---|---|
| দিলাম / বেচা (`box: gave`) | `sale` | `payment_made` |
| পেলাম (`box: got`) | `payment_received` | `purchase` |
| ফেরত | `refund` | `refund` |

The client sends `box: 'gave' \| 'got'` and never needs to know these rules —
`Transaction.kindFor(box, customerType)` resolves it server-side.

Cashbox flows: `cash_sale` +1, `owner_in` +1, `cash_purchase` −1, `expense` −1,
`owner_out` −1. `currentCash` is their signed sum.

## Auth & per-user data

Login is by phone number. There is no bcrypt dependency: passwords use
`crypto.scryptSync` with a per-user random salt and `crypto.timingSafeEqual`
for the comparison.

Session tokens are opaque 32-byte hex strings. Only their SHA-256 is stored, at
most 5 live sessions per account, so a database leak does not hand over usable
sessions. The client sends `Authorization: Bearer <token>`.

Every document carries an `owner: ObjectId`, and **every** query filters on it:

| route group | guard |
|---|---|
| `/api/auth` | public (register/login); `/me`, `/logout`, `/password` check the token themselves |
| `/api/uploads` | `requireAuth` inside the router |
| `/api`, `/api/customers`, `/api/cashbox` | one `requireAuth` mount each |

A customer belonging to somebody else is indistinguishable from one that does
not exist: `ownCustomer()` scopes the lookup by `{_id, owner}` and throws a 404
otherwise. `Profile` and `Wallet` are one-per-user (`owner` unique) rather than
global singletons.

Login deliberately returns the same message for an unknown number and a wrong
password, so the endpoint cannot be used to enumerate accounts.

### Verbs

`java.net.HttpURLConnection` — the Android client's HTTP stack — refuses to send
`PATCH`. The app therefore posts with `X-HTTP-Method-Override: PATCH` and a
middleware in `index.js` rewrites `req.method` before routing. The routes keep
their real verbs; the guard is applied *after* the rewrite, so the override
cannot smuggle an unauthenticated write.

## Image uploads

`POST /api/uploads` takes `{ data, folder?, publicId?, tags? }` where `data` is
a `data:image/jpeg;base64,…` URI, and returns the Cloudinary `secure_url` plus
its `public_id`. JPEG, PNG, WebP and GIF are accepted, capped at 8 MB decoded.

The signed upload happens server-side: SHA-1 over the alphabetically sorted
params with the API secret appended, sent as multipart `FormData`. The device
never sees the secret.

Every `public_id` is namespaced `${ownerId}_…`, and `DELETE /api/uploads` only
removes ids carrying the caller's own prefix — one account cannot delete
another's assets. A public id contains slashes, so the delete route accepts both
`/api/uploads/:publicId` (URL-encoded) and `/api/uploads?publicId=<id>`.

Customers carry `photoUrl` + `photoPublicId`. When a photo is replaced or
cleared, the superseded Cloudinary asset is destroyed best-effort; a failure
there is logged, never fatal.

## API

Base URL `/api`. Every display string (amounts, dates, relative times) is
formatted in Bengali server-side, so the client holds no locale logic.

### Auth

| method | path | notes |
|---|---|---|
| POST | `/auth/register` | `{name, phone, password}` → `{token, user}`; 409 if the number exists; provisions profile + wallet |
| POST | `/auth/login` | `{phone, password}` → `{token, user}`; 401 with one shared message |
| GET | `/auth/me` | the caller, never a hash or salt |
| POST | `/auth/logout` | revokes **only** the calling device's token |
| POST | `/auth/password` | keeps this device signed in, drops every other session |

### Uploads

| method | path | notes |
|---|---|---|
| GET | `/uploads/status` | `{configured, maxBytes}` — lets the app hide the photo button |
| POST | `/uploads` | base64 data URI → `{url, publicId, width, height, bytes, format}` |
| DELETE | `/uploads/:publicId` or `?publicId=` | owner-only |

### App

| method | path | notes |
|---|---|---|
| GET | `/health` | `{ok, db, database, host, uptimeSeconds}` |
| GET | `/profile` | business name, gold trial, inbox badge |
| PATCH | `/profile` | partial update of the singleton |
| GET | `/summary` | পাবো / দেবো totals + customer label |
| GET | `/wallet` | balance, 8 services, benefits |
| POST | `/wallet/open-account` | enables all services |
| GET | `/menu` | drawer sections with **live** counts |
| GET | `/bootstrap` | profile + summary + wallet + menu in one call |
| GET | `/reports/summary?days=N` | clamped to 1…365, default 30 |

### Customers

| method | path | notes |
|---|---|---|
| GET | `/customers?q=&type=` | `q` is a case-insensitive name search |
| POST | `/customers` | 400 on a missing name or a malformed phone; accepts `note`, `photoUrl`, `photoPublicId` |
| GET | `/customers/:id` | customer + headline + entries |
| PATCH | `/customers/:id` | rename re-derives the initials; `note`/photo update in place |
| DELETE | `/customers/:id` | also deletes that customer's transactions and its Cloudinary asset |
| GET | `/customers/:id/transactions` | newest first |
| POST | `/customers/:id/transactions` | accepts `{box}` **or** `{kind}` |

### Cashbox

| method | path | notes |
|---|---|---|
| GET | `/cashbox` | dashboard: today's totals, current cash, 5 rows |
| GET | `/cashbox/entries?kind=&limit=` | `limit` clamped to 500 |
| POST | `/cashbox/entries` | 400 on a bad kind or amount |
| DELETE | `/cashbox/entries/:id` | returns the recomputed dashboard |

### Amounts

`lib/http.js` `parseAmount` accepts Bengali digits, thousands separators and a
currency sign, so `"১,৫০০.৫০"`, `"1,500.50"` and `"৳1500.5"` all parse to
`1500.5`. Garbage returns `NaN`, which the routes turn into a 400 with a Bengali
message.

### Errors

All failures share one envelope, produced by the single error middleware:

```json
{ "error": "REQUEST_ERROR", "message": "সঠিক পরিমাণ দিন" }
```

`UNAUTHORIZED` for 401, `INTERNAL_ERROR` (with details logged) for 5xx,
`NOT_FOUND` for unmatched routes.

## Verifying

```bash
npm start          # terminal 1
npm run seed:fresh # terminal 2 (so the two demo accounts exist)
npm run verify     #            -> 86 checks, 0 failures
npm run smoke      #            -> quick end-to-end
```

`verify.js` covers the whole surface in one pass:

- **auth** — 401 without/with a junk token, every registration validation path,
  a wrong password, the identical message for an unknown number (no account
  enumeration), local-format number normalisation, `/me` never leaking a hash,
  logout revoking only the calling token, and a fresh account being provisioned
  with an empty book.
- **isolation** — the two seeded accounts see different customers with **zero
  id overlap**, and cross-tenant read, delete and transaction-write all 404
  while the owner's record survives.
- **uploads** — Cloudinary configured, non-image and empty payloads rejected,
  a real asset stored, the public id namespaced to its owner, and a foreign
  account refused deletion.
- **photos on a customer** — `photoUrl` + `বিবরণ` persist, the photo appears in
  the home list, clearing it empties both fields, and the
  `X-HTTP-Method-Override` path the Android app uses behaves exactly like PATCH.
- **the books** — every route plus the validation and 404 paths, asserting the
  *derived* values actually moved (e.g. `বেচা ১,২৩৪.৫০ → পাবো ১,২৩৪.৫০`, then
  `পেলাম ২৩৪.৫০ → পাবো ১,০০০.০০`).

It then removes everything it made and asserts the baseline totals are back
where they started.

Both suites flip the wallet, so re-run `npm run seed:fresh` afterwards if you
want the demo in its pristine state.

## Connecting the Android app

The app calls `http://127.0.0.1:4000/api` and reaches this machine through an
`adb reverse` tunnel — no LAN, no firewall rule, no IP configuration:

```bash
adb reverse tcp:4000 tcp:4000
```

The tunnel drops on every replug. `../run-on-device.sh` handles the whole chain
(reverse tunnel → health check → build → install → launch), and also supports
wireless debugging via `--pair` / `--connect`.

> Since this backend is superseded, the script now starts the **Next.js** API in
> `../web/` by default. If you deliberately want to run *this* Express server
> instead, pass `API_DIR=backend`.
