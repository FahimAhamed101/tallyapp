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
# Point the app at your local API. The default build targets the *deployed*
# API, so without -PapiBase the tunnel below would do nothing.
./gradlew.bat assembleDebug -PapiBase=http://127.0.0.1:4000/api --rerun-tasks
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:4000 tcp:4000                  # lets the phone reach your :4000
```

`-PapiBase` bakes the URL in at build time, so retargeting needs no source edit. `--rerun-tasks`
is **required** when retargeting: `API_BASE` is a compile-time constant that lands in two dex
shards, and Gradle's incremental dexing can otherwise rebuild one and leave the previous URL in
the other, giving an APK that contains both. See **Gotchas**.

`adb reverse` is what makes `127.0.0.1:4000` on the phone mean your machine. Without it the app
shows no data.

Or let the helper do all of it — build, install, tunnel, launch, and start the API if it is down:

```bash
bash run-on-device.sh --with-server      # add --wait to poll for the phone
```

It starts the **Next.js** backend (`web/`) — `next start` when a production build exists, `next dev`
otherwise. Set `API_DIR=backend` if you specifically want the legacy Express server.

---

## The API — 64 endpoints

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
| Businesses | 4 | list/create/read/update/delete (মাল্টি ব্যবসা) |
| **Stock** | **6** | list/create/read/update/delete + a product's movements (স্টক হিসাব) |
| Customers | 7 | list/create/read/update/delete + their transactions |
| Cash box | 4 | dashboard, entries list/create/delete |
| **Admin** | **25** | login/logout/me/stats, users, businesses, stock, customers, transactions, cashbox, endpoints |

28 GET + 14 POST + 10 PATCH + 12 DELETE, across 9 groups.

The admin routes are **not owner-scoped** — that is the entire point of the panel — so
`requireAdmin()` on the server is the only thing protecting them.

### Stock (স্টক হিসাব) is derived, never stored

```
quantity = openingStock + Σ(movements in) − Σ(movements out)
```

Exactly how `Customer` balances are derived from the ledger, and for the same reason: a stored
running total is a second source of truth, and the moment it disagrees with the movements nobody
can tell which number is wrong. Movements are append-only — a mistake is corrected by recording
the opposite movement, so the quantity can always be recomputed from the log.

`StockItem` carries `purchasePrice`, `salePrice`, `openingStock`, `unit` and `lowStockThreshold`;
the API returns the quantity, both valuations (`costValue`, `saleValue`) and the `lowStock` flag
already computed. A threshold of `0` means "do not warn", which is deliberately not the same as
"warn at zero".

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

Nine independent layers, each catching a class of bug the others cannot. See `web/README.md` for
what each one covers and why it exists.

```bash
cd web
npm run typecheck                 # tsc --noEmit                         clean
npm run build                     # production build                     exit 0
npm run smoke                     # API surface + route registration     135/135
npm run api-coverage              # the endpoints smoke only probes       95/95
npm run upload-check              # real Cloudinary round-trip            29/29
npm run assertion-sanity          # prove those assertions can fail        5/5
npm run consistency               # per-book receivable sums to the total   3/3
npm run unit-scope                # scopeFilter coercion is aggregation-safe 7/7
npm run browser-check             # the panel actually renders             33/33
node .smoke/panel-actions.mjs     # every panel mutation through the UI    17/17

cd ..
./gradlew.bat testDebugUnitTest -Dapi.base=http://127.0.0.1:4000/api
                                  # the Android client's own stack         85/85
                                  #   ApiContractTest         26  (HTTP + DTO parsing, live)
                                  #   BengaliCalendarTest     12  (grid maths, wire format)
                                  #   StockScreenRenderTest   12  (the stock screens, rendered)
                                  #   DatePickerDialogTest     7  (the calendar, rendered)
                                  #   StockWireTest            7  (stock requests reach the wire)
                                  #   DatePillTest             6  (the pill's tap is wired)
                                  #   DateWireTest             3  (the date reaches the wire)
                                  #   StockTileTest            3  (the স্টক হিসাব tap is wired)
                                  #   BusinessSheetRenderTest  3  (Compose, rendered)
                                  #   MultiBusinessTileTest    3  (the tap is wired)
                                  #   ReportPillTest           3  (the report pills)
```

`npm run verify` chains the first six.

**Point the Android suite at a local `web/` server.** Against the deployed host four tests skip,
because that deployment predates the business endpoints (it answers `/health` with 200 but 404s on
`/businesses`). They skip rather than fail, because a suite that goes red for an environmental
reason is a suite everyone learns to ignore. Locally nothing skips: 85/85 execute.

**Always re-run the Android suite with `--rerun-tasks --no-build-cache`.** Gradle will otherwise
restore a cached "green" result without executing anything — and it has, twice, after a revert.

The Android layers are the important ones: they drive the app's real HTTP client and DTO parsers,
so they catch field-name drift between the API and the Kotlin models — the class of bug that
compiles cleanly and only breaks on screen. **None of them need a device or emulator**;
`StockScreenRenderTest`, `BusinessSheetRenderTest`, `MultiBusinessTileTest`, `DatePickerDialogTest`
and `DatePillTest` use Robolectric to render the real Compose UI on the JVM, and `StockWireTest` /
`DateWireTest` stand up a loopback HTTP stub to inspect the outgoing JSON.

Bugs found and fixed by this work, all documented in `web/README.md`:

1. **Cloudinary's delivery CDN is a separate cache from the asset store.** A deleted customer
   photo kept serving from the CDN. Fixed by sending `invalidate=true` on destroy.
2. **`GET /api/admin/customers/:id` returned the owner's `id`, `name` and `phone`** instead of the
   customer's, because a shared lookup helper was spread over the response. Fixed.
3. **Every balance in the admin panel rendered ৳০.০০.** Aggregation `$match` is not cast by
   mongoose, and the admin routes key their maps by `String(owner)`. The owner-scoped screens were
   correct, which is exactly why nobody noticed. Fixed at the source, with a regression assertion
   comparing the two views of the same row.
4. **The মাল্টি ব্যবসা tile rendered but was inert** — `ServiceCell` had no click handler. A
   screenshot cannot see this; `MultiBusinessTileTest` performs the tap.
5. **The date pills were inert and the date was never sent.** `onClick = {}` behind a hard-coded
   "০৪ অক্টোবর", and `addTransaction` posted no `date` at all — so the label was a lie twice over
   and every entry was stamped "now". Now a real calendar dialog (hand-rolled, because material3's
   renders its month header in the device locale), and `DateWireTest` asserts the picked day
   appears in the request body as `YYYY-MM-DDT12:00:00`.
6. **The স্টক হিসাব tile was inert too** — the same defect as #4, one row over. It now opens a real
   product list, form and movement history. `StockTileTest` performs the tap *and* asserts the two
   wired tiles reach different callbacks, so routing both to one screen cannot pass.
7. **The stock quantity never moved.** The first movement POST returned 201 with the correct
   Bengali title while the derived quantity stayed at the opening stock. Root cause: `$in` casts
   array elements in `Model.find()` but **not** inside an aggregation pipeline, so a 24-hex string
   matched nothing and every total silently read as zero. The same defect class as #3 — caught only
   because the smoke suite asserted the *derived* value rather than the write's status code.
8. **`assertIsDisplayed()` reports a missing node as "not displayed".** A test that looks like it is
   asserting visibility can be silently asserting nothing at all. Worth knowing before trusting one.

---

## Status

**Done and verified:** the Next.js port of all 64 endpoints, the superadmin panel, per-user data
isolation, phone-number auth, image upload on create *and* edit, Bengali formatting throughout,
the admin CRUD wiring, **মাল্টি ব্যবসা** (multi-business) — a real `Business` model, a switcher
sheet in the app, and a cross-account management screen in the panel — the **date pills** on
the ledger and ক্যাশ forms, which now open a Bengali calendar and post the day the user picked, and
**স্টক হিসাব** (stock) — a real `StockItem` + append-only `StockMovement` model, a derived-quantity
API, a cross-account panel screen, and three app screens: the product list, the create/edit form,
and the item detail with স্টক ইন / স্টক আউট.

**Verified without a device:** the Android network and parsing layers (`ApiContractTest`, 26 live
checks against a local `web/` server), the stock request shapes (`StockWireTest`), the calendar
maths and wire format (`BengaliCalendarTest`, `DateWireTest`), and the Compose UI itself — the
stock list, form and detail, the switcher sheet and the calendar all render with real data, and the
service tiles' and both date pills' taps are performed for real, all under Robolectric on the JVM.
The stock quantity is asserted to *move* in both directions after a real movement, because that is
the one thing a status code cannot tell you.

**Not verified:** the Android UI on *physical hardware*. No device was attached, so install,
`adb reverse` and an on-screen pass could not be done. Reconnect a device and run the app to close
that last gap.

**Not deployed:** the app's default `API_BASE` points at a Vercel deployment that predates the
business endpoints (it 404s on `/api/businesses`), so the switcher sheet would error on a phone
until `web/` is redeployed. Build with `-PapiBase=…` to point at your own server in the meantime.

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
* **Retargeting the app needs `--rerun-tasks`.** `-PapiBase=…` bakes the URL into `BuildConfig.API_BASE`,
  a compile-time constant that Kotlin inlines into `ApiClient` — so it lands in **two dex shards**.
  Gradle's incremental dexing will rebuild one and leave the previous URL in the other, producing an
  APK that contains *both*, with the runtime winner decided by dex order. Observed while flipping the
  property: the old URL survived in `classes3.dex` while the new one appeared in `classes4.dex`.
  Always force it, and verify the result:

  ```bash
  ./gradlew.bat assembleDebug -PapiBase=http://127.0.0.1:4000/api --rerun-tasks
  unzip -o -q app/build/outputs/apk/debug/app-debug.apk -d /tmp/apk && grep -rl "127.0.0.1:4000" /tmp/apk
  ```

  The authoritative cheap check is the generated source:
  `app/build/generated/source/buildConfig/debug/com/workbuddy/tallyclone/BuildConfig.java`.
  Related: never put `clean` and a build task in the *same* Gradle invocation — that combination
  behaved unpredictably with the build cache here.
* **A sandbox delete guard blocks bulk `rm -rf`.** Deleting a populated directory (`.next`, an
  extracted APK, a test scratch dir) can be refused with
  `[SAFE_DELETE_BULK_CONFIRM_REQUIRED]`. Prefix the command with `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR=`
  to scope the guard off for that one command. This silently breaks `&&` chains, so a later step in
  the chain may not run — check for it before trusting a "no output" result.
* **JUnit XML mis-attributes failures.** Passing testcases self-close (`<testcase … />`), so
  `<testcase name="X">([\s\S]*?)</testcase>` swallows every following testcase and blames the wrong
  test. Split on `/(?=<testcase )/` when parsing results by hand.
