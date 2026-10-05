# টালিখাতা (TallyKhata) clone — Android app + Next.js API + admin panel

A working clone of the TallyKhata shopkeeper app: a Kotlin/Compose Android client, the
Next.js API it talks to, and a superadmin panel for operating the whole platform.

> **New here? Read this file first, then `web/README.md`.**
> There are three directories and only two of them matter.

---

## What is in this repo

| Directory | What it is | Status |
|---|---|---|
| **`web/`** | The **Next.js 14** API + superadmin panel | ✅ **This is the backend. Use it.** |
| `backend/` | The original Express + Mongoose API | ⚠️ **Superseded** — kept as the reference implementation only |
| `app/` | The Kotlin / Jetpack Compose Android client | ✅ Current |

Both `web/` and `backend/` implement the same API and listen on **port 4000**, so run one or the
other — never both. `web/` is the one that has the admin panel and is fully verified.

```
  Android app  ──┐
  (app/)         │  Authorization: Bearer <token>
                 ├──────────────────────────────►  Next.js API  ──►  MongoDB Atlas
  Admin panel  ──┘                                 (web/, :4000)      (db: tally)
  (/admin)         tally_session cookie                                  │
                                                                         ▼
                                                                    Cloudinary
                                                              (customer/supplier photos)
```

The Android client's base URL is unchanged — it still points at `http://127.0.0.1:4000/api` — so
it works against the ported server with **no code change**.

---

## Quick start

### 1. Run the API

```bash
cd web
npm install
npm run seed          # promotes the admin account (idempotent)
npm run dev           # http://localhost:4000
```

`web/.env.local` needs the Atlas URI, a Cloudinary key/secret, and `SEED_SECRET`. Copy
`web/.env.local.example` and fill it in.

Both modes are verified. `npm run dev` is what you want while editing; the verification suite runs
against the production build, so re-run it with `npm run build && npm run start` before shipping.

> First request after a cold start may take ~5s: the driver's SRV lookup fails against the local
> resolver and `dbConnect()` re-applies public resolvers and retries once. That is expected, and
> the log says so explicitly.

### 2. Open the admin panel

<http://localhost:4000/admin/login>

| Field | Value |
|---|---|
| Phone | `+8801706617723` |
| Password | `123456` |

That account is promoted to `role: 'admin'` by `npm run seed`. Accounts created by the Android
app always get `role: 'user'` and can never grant themselves panel access.

### 3. Run the Android app

```bash
cd ..                       # repo root
./gradlew.bat assembleDebug                    # NOTE: .bat — see gotchas
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:4000 tcp:4000                  # lets the phone reach your :4000
```

`adb reverse` is what makes `127.0.0.1:4000` on the phone mean your machine. Without it the app
shows no data.

Or let the helper do all of it — build, install, tunnel, launch, and start the API if it is down:

```bash
bash run-on-device.sh --with-server      # add --wait to poll for the phone
```

It starts the **Next.js** backend (`web/`) — `next start` when a production build exists, `next dev`
otherwise. Set `API_DIR=backend` if you specifically want the legacy Express server.

---

## The API — 48 endpoints

Every endpoint is defined once in **`web/lib/endpoints.ts`**, which is the single source of truth:
the JSON API, the panel's explorer page and the test suite all read from it, so they cannot
disagree.

Browse all of them at **<http://localhost:4000/admin/endpoints>** (sign in first), or as JSON:

```bash
curl -s http://localhost:4000/api/admin/endpoints \
  -H "Cookie: tally_session=<value>"
```

| Group | Endpoints | What it covers |
|---|---|---|
| System | 1 | health |
| Auth | 5 | register, login, me, logout, change password |
| Uploads | 4 | Cloudinary status, upload, two delete forms |
| App shell | 8 | profile (read + edit), summary, wallet, open-account, menu, bootstrap, reports |
| Customers | 7 | list/create/read/update/delete + their transactions |
| Cash box | 4 | dashboard, entries list/create/delete |
| **Admin** | **19** | login/logout/me/stats, users, customers, transactions, cashbox, endpoints |

The admin routes are **not owner-scoped** — that is the entire point of the panel — so
`requireAdmin()` on the server is the only thing protecting them.

### Two auth carriers, one session table

The same `sessions` array on the user document backs both:

* **`Authorization: Bearer <token>`** — what the Android app sends. Unchanged from day one.
* **`tally_session` httpOnly cookie** — what the admin panel uses in a browser.

Both resolve through the same SHA-256 token hash, so logging out on one kills the other.

### PATCH over POST

`java.net.HttpURLConnection` cannot send `PATCH`, so the Android client sends `POST` with
`X-HTTP-Method-Override: PATCH`. Next.js dispatches on the real verb, so the override is resolved
*inside* the handler (`web/lib/route-utils.ts`). A plain `POST` to those paths still correctly
returns 404.

---

## Verification

Seven independent layers, **239 assertions, all passing**. Each catches a class of bug the others
cannot. See `web/README.md` for what each one covers and why it exists.

```bash
cd web
npm run typecheck                 # tsc --noEmit                        clean
npm run build                     # production build                    exit 0
npm run smoke                     # API surface + route registration    83/83
npm run api-coverage              # the endpoints smoke only probes     65/65
npm run assertion-sanity          # prove those assertions can fail      5/5
npm run upload-check              # real Cloudinary round-trip          29/29
node .smoke/browser-check.mjs     # the panel actually renders          25/25
node .smoke/panel-actions.mjs     # every panel mutation through the UI 17/17

cd ..
./gradlew.bat testDebugUnitTest --tests "com.workbuddy.tallyclone.ApiContractTest"
                                  # the Android client's own stack      20/20
```

The Android one is the important one: it drives the app's real HTTP client and DTO parsers, so it
catches field-name drift between the API and the Kotlin models — the class of bug that compiles
cleanly and only breaks on screen. **It needs no device or emulator.**

Two bugs were found and fixed by this work, both documented in `web/README.md`:

1. **Cloudinary's delivery CDN is a separate cache from the asset store.** A deleted customer
   photo kept serving from the CDN. Fixed by sending `invalidate=true` on destroy.
2. **`GET /api/admin/customers/:id` returned the owner's `id`, `name` and `phone`** instead of the
   customer's, because a shared lookup helper was spread over the response. Fixed.

---

## Status

**Done and verified:** the Next.js port of all 48 endpoints, the superadmin panel, per-user data
isolation, phone-number auth, image upload on create *and* edit, Bengali formatting throughout, and
the admin CRUD wiring.

**Not verified:** actually *rendering* the Android UI on a phone. No device was attached, so
`adb reverse` and a launch could not be done. The client's network and parsing layers are proven
against this server by `ApiContractTest`; only the on-screen pass is outstanding. Reconnect the
device and run the app to close it.

---

## Gotchas

Both `web/README.md` ("Environment gotchas") and the notes below are specific to developing this on
Windows. They are not Next.js or Android bugs.

* **Use `./gradlew.bat`, not `./gradlew`.** The bash script passes a POSIX `APP_HOME` that Windows
  `java.exe` cannot resolve, which shows up as
  `Could not find or load main class org.gradle.wrapper.GradleWrapperMain`. The wrapper jar is fine.
* **`next build` / `next dev` can be blocked by a sandbox delete guard.** The working recipe is a
  standalone `rm -rf .next`, then `CODEBUDDY_SAFE_DELETE_ENABLED=0 ./node_modules/.bin/next build`.
  Do **not** clear `NODE_OPTIONS` — that kills the build worker with an access violation.
* **`npm install` can be rolled back** by the same guard, leaving packages half-extracted. Overlay
  the official tarball rather than reinstalling. Details in `web/README.md`.
* **Port 4000 collision.** `web/` and `backend/` both want it. Check before assuming your server is
  the one answering.
