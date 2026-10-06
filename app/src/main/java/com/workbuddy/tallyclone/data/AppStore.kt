package com.workbuddy.tallyclone.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Date

/**
 * Single source of truth for the whole app. Plain class + Compose state, so it
 * can be held with `remember` in AppRoot without pulling in a ViewModel library.
 *
 * Two jobs:
 *  1. own the session (who is logged in, and the bearer token that scopes every
 *     request to that account), and
 *  2. cache the API slices the screens read.
 *
 * Every write refreshes the slices it touched, so the UI can never show a stale
 * balance after a form is submitted.
 *
 * It also owns the active business (মাল্টি ব্যবসা). That is not just cached
 * data: the selection is pushed into [ApiClient] as the `X-Business-Id` header,
 * so every subsequent request is scoped to it, and persisted so a relaunch
 * returns you to the same book.
 */
class AppStore {

    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var connected by mutableStateOf(false)
        private set

    // ---- session ----------------------------------------------------------

    /** The logged-in account, or null while the login screen is showing. */
    var user by mutableStateOf<UserAccount?>(null)
        private set

    /** True while we are checking the stored token on cold start. */
    var authChecking by mutableStateOf(true)
        private set

    val isLoggedIn: Boolean get() = user != null

    // ---- data slices ------------------------------------------------------

    var profile by mutableStateOf<Profile?>(null)
        private set
    var summary by mutableStateOf<Summary?>(null)
        private set
    var customers by mutableStateOf<List<CustomerItem>>(emptyList())
        private set
    var cashbox by mutableStateOf<CashboxDashboard?>(null)
        private set
    var wallet by mutableStateOf<WalletData?>(null)
        private set
    var menu by mutableStateOf<MenuData?>(null)
        private set

    // ---- স্টক হিসাব --------------------------------------------------------

    /** Every product in the active book, name-ordered, with derived quantities. */
    var stock by mutableStateOf<List<StockItem>>(emptyList())
        private set

    /** The list header's totals, summed server-side from the same rows. */
    var stockSummary by mutableStateOf<StockSummary?>(null)
        private set

    // ---- ব্যবসার নোট --------------------------------------------------------

    var notes by mutableStateOf<List<NoteItem>>(emptyList())
        private set

    // ---- সেটিংস ------------------------------------------------------------

    /**
     * The সেটিংস screen's state: the two general toggles, whether a PIN exists,
     * and every label that depends on those. Held as one object rather than a
     * handful of booleans so a partial response can never render a screen that
     * is half from the server and half from a stale default.
     */
    var settings by mutableStateOf<AppSettings?>(null)
        private set

    // ---- মাল্টি ব্যবসা ------------------------------------------------------

    /** Every book on the account, oldest first — what the switcher sheet lists. */
    var businesses by mutableStateOf<List<BusinessItem>>(emptyList())
        private set

    /** The book every request is currently scoped to. */
    var activeBusinessId by mutableStateOf<String?>(null)
        private set

    /** Shown in the sheet's header and next to the active row. */
    var activeBusinessName by mutableStateOf("")
        private set

    /** The server's cap (five). Drives whether '+ নতুন ব্যবসা' is offered. */
    var maxBusinesses by mutableStateOf(5)
        private set

    val canAddBusiness: Boolean get() = businesses.size < maxBusinesses

    val activeBusiness: BusinessItem? get() = businesses.firstOrNull { it.id == activeBusinessId }

    /**
     * The name shown in the gold toolbar. With মাল্টি ব্যবসা this is the *book*
     * you are in, not the account holder's name — the two differ as soon as a
     * second book exists, and showing the account name would make a switch look
     * like it had not happened. Falls back to the profile while the book list is
     * still loading.
     */
    val toolbarName: String get() = activeBusinessName.ifBlank { profile?.name ?: "…" }

    fun clearError() {
        error = null
    }

    /**
     * Runs a network block off the main thread and records any failure in
     * [error]. The failure bookkeeping happens back on the caller's dispatcher
     * (the main one), so state writes stay where Compose expects them.
     */
    private suspend fun <T> call(block: suspend () -> T): Result<T> {
        val result = withContext(Dispatchers.IO) { runCatching { block() } }
        result.onFailure {
            error = it.message ?: "সার্ভারে সংযোগ করা যায়নি"
            connected = false
        }
        return result
    }

    // ---- auth -------------------------------------------------------------

    /**
     * Cold start. If a token was stored, confirm it with the server before
     * showing the main app; a rejected token drops us back to the login screen.
     */
    suspend fun restoreSession() {
        authChecking = true
        val cached = SessionStore.user()
        if (SessionStore.token().isNullOrBlank() || cached == null) {
            user = null
            authChecking = false
            return
        }

        // Optimistic: show the app straight away, then revalidate.
        user = cached
        val refreshed = withContext(Dispatchers.IO) {
            runCatching { UserAccount.from(ApiClient.get("/auth/me").getJSONObject("user")) }
        }
        refreshed.onSuccess {
            user = it
            SessionStore.saveUser(it)
            bootstrap()
        }.onFailure {
            if (it is UnauthorizedException) {
                SessionStore.clear()
                user = null
            }
            // Any other failure is a network problem: stay signed in offline.
        }
        authChecking = false
    }

    suspend fun login(phone: String, password: String): Result<Unit> = authenticate("/auth/login") {
        JSONObject().put("phone", phone.trim()).put("password", password)
    }

    suspend fun register(name: String, phone: String, password: String): Result<Unit> =
        authenticate("/auth/register") {
            JSONObject()
                .put("name", name.trim())
                .put("phone", phone.trim())
                .put("password", password)
        }

    private suspend fun authenticate(
        path: String,
        buildBody: () -> JSONObject,
    ): Result<Unit> {
        error = null
        val result = withContext(Dispatchers.IO) {
            runCatching {
                val auth = AuthResult.from(ApiClient.post(path, buildBody()))
                if (auth.token.isBlank()) throw ApiException(500, "সার্ভার টোকেন দেয়নি")
                auth
            }
        }

        return result.map { auth ->
            SessionStore.save(auth.token, auth.user)
            user = auth.user
            connected = true
            error = null
            Unit
        }.onFailure {
            error = it.message ?: "লগইন করা যায়নি"
            connected = false
        }
    }

    /**
     * Drops the session. The server call is best-effort: even if the device is
     * offline we still forget the token locally, and we always wipe the cached
     * slices so the next account can never see the previous one's books.
     */
    suspend fun logout() {
        withContext(Dispatchers.IO) { runCatching { ApiClient.post("/auth/logout") } }
        SessionStore.clear()
        user = null
        clear()
        error = null
    }

    /** Forgets everything belonging to the signed-out account. */
    fun clear() {
        profile = null
        summary = null
        customers = emptyList()
        cashbox = null
        wallet = null
        menu = null
        stock = emptyList()
        stockSummary = null
        settings = null
        businesses = emptyList()
        activeBusinessId = null
        activeBusinessName = ""
        maxBusinesses = 5
        connected = false
        loading = true
    }

    /**
     * Called by [ApiClient] when the server rejects the token (expired, revoked
     * or from a wiped database). Drops the session and leaves an explanation on
     * the login screen instead of a wall of failed requests.
     */
    suspend fun onTokenRejected() {
        if (user == null) return
        SessionStore.clear()
        user = null
        clear()
        error = "সেশনের মেয়াদ শেষ — আবার লগইন করুন"
    }

    // ---- reads ------------------------------------------------------------

    /**
     * Cold start: one round trip for the static-ish slices, then the lists.
     *
     * If a stored business selection no longer exists — the book was deleted
     * from another device — the server answers 404. Rather than stranding the
     * user on an error screen, the selection is dropped and the call retried
     * once against the account's primary book.
     */
    suspend fun bootstrap() {
        loading = true
        error = null

        var bootResult = call { Bootstrap.from(ApiClient.get("/bootstrap")) }
        if (bootResult.isFailure && isStaleBusinessSelection(bootResult)) {
            applyBusinessSelection(null)
            error = null
            bootResult = call { Bootstrap.from(ApiClient.get("/bootstrap")) }
        }

        bootResult.onSuccess { boot ->
            // The server is the authority on who we are (e.g. after a rename).
            boot.user.takeIf { it.id.isNotBlank() }?.let {
                user = it
                SessionStore.saveUser(it)
            }
            profile = boot.profile
            summary = boot.summary
            wallet = boot.wallet
            menu = boot.menu
            businesses = boot.businesses
            if (boot.maxBusinesses > 0) maxBusinesses = boot.maxBusinesses
            activeBusinessId = boot.activeBusinessId.takeIf { it.isNotBlank() }
            activeBusinessName = boot.activeBusinessName
            // Echo the server's answer back into the header and the prefs, so a
            // client that sent no header is pinned to the primary from now on.
            SessionStore.saveBusinessId(activeBusinessId)
        }

        if (bootResult.isSuccess) {
            call { Pair(ApiClient.get("/customers"), ApiClient.get("/cashbox")) }
                .onSuccess { (customerList, cash) ->
                    customers = parseCustomers(customerList)
                    cashbox = CashboxDashboard.from(cash)
                    connected = true
                    error = null
                }
        }
        loading = false
    }

    /** True when the request failed only because the stored book is gone. */
    private fun isStaleBusinessSelection(result: Result<*>): Boolean =
        ApiClient.businessId != null && (result.exceptionOrNull() as? ApiException)?.status == 404

    suspend fun refreshCustomers() {
        call { ApiClient.get("/customers") }.onSuccess {
            customers = parseCustomers(it)
            connected = true
        }
    }

    suspend fun refreshSummary() {
        call { ApiClient.get("/summary") }.onSuccess {
            summary = Summary.from(it)
            connected = true
        }
    }

    suspend fun refreshCashbox() {
        call { ApiClient.get("/cashbox") }.onSuccess {
            cashbox = CashboxDashboard.from(it)
            connected = true
        }
    }

    suspend fun refreshMenu() {
        call { ApiClient.get("/menu") }.onSuccess {
            menu = MenuData.from(it)
            connected = true
        }
    }

    /**
     * Re-reads just the shop profile. The drawer header and the gold toolbar
     * both render from this slice, so a rename or a phone change made on the
     * সেটিংস screen has to land here or the old value stays on screen.
     */
    suspend fun refreshProfile() {
        call { Profile.from(ApiClient.get("/profile")) }.onSuccess {
            profile = it
            connected = true
        }
    }

    suspend fun refreshWallet() {
        call { ApiClient.get("/wallet") }.onSuccess {
            wallet = WalletData.from(it)
            connected = true
        }
    }

    /** Reloads everything the home tab shows after a write. */
    suspend fun refreshHome() {
        refreshCustomers()
        refreshSummary()
    }

    suspend fun loadLedger(customerId: String): Result<LedgerData> =
        call { LedgerData.from(ApiClient.get("/customers/$customerId")) }.onSuccess {
            connected = true
        }

    suspend fun loadTransactions(): Result<List<TransactionDetailItem>> = call {
        val o = ApiClient.get("/transactions")
        val arr = o.optJSONArray("items") ?: org.json.JSONArray()
        val list = mutableListOf<TransactionDetailItem>()
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { list.add(TransactionDetailItem.from(it)) }
        }
        list
    }

    suspend fun loadCashboxEntries(kind: String? = null): Result<List<CashboxEntryItem>> = call {
        val path = if (kind.isNullOrBlank()) "/cashbox/entries" else "/cashbox/entries?kind=$kind"
        val o = ApiClient.get(path)
        val arr = o.optJSONArray("items") ?: org.json.JSONArray()
        val list = mutableListOf<CashboxEntryItem>()
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { list.add(CashboxEntryItem.from(it)) }
        }
        list
    }

    suspend fun loadReportSummary(): Result<ReportSummaryData> = call {
        ReportSummaryData.from(ApiClient.get("/reports/summary"))
    }

    // ---- স্টক হিসাব --------------------------------------------------------

    /**
     * Reloads the স্টক হিসাব list. The summary comes down in the same envelope
     * as the rows, so the header card can never disagree with the list under it.
     */
    suspend fun refreshStock() {
        call { StockList.from(ApiClient.get("/stock")) }.onSuccess {
            stock = it.items
            stockSummary = it.summary
            connected = true
        }
    }

    /** One product plus its movement history, newest first. */
    suspend fun loadStockItem(id: String): Result<StockDetail> =
        call { StockDetail.from(ApiClient.get("/stock/$id")) }.onSuccess {
            connected = true
        }

    // ---- সেটিংস ------------------------------------------------------------

    suspend fun refreshSettings() {
        call { AppSettings.from(ApiClient.get("/settings")) }.onSuccess {
            settings = it
            connected = true
        }
    }

    /**
     * Flips one general toggle.
     *
     * Only the key that changed goes on the wire, because the server applies
     * exactly the keys it is sent — so a request that flipped টাকার অঙ্কে দশমিক
     * cannot clobber নোটিফিকেশন সাউন্ড with a value the app guessed. The full
     * refreshed view comes back, which is what the screen then renders.
     */
    suspend fun setDecimalAmount(value: Boolean): Result<AppSettings> =
        patchSettings(JSONObject().put("decimalAmount", value))

    suspend fun setNotificationSound(value: Boolean): Result<AppSettings> =
        patchSettings(JSONObject().put("notificationSound", value))

    suspend fun setVoiceNotification(value: Boolean): Result<AppSettings> =
        patchSettings(JSONObject().put("voiceNotification", value))

    // ---- ব্যবসার নোট --------------------------------------------------------

    suspend fun refreshNotes() {
        call {
            val o = ApiClient.get("/notes")
            val arr = o.optJSONArray("items") ?: org.json.JSONArray()
            val list = mutableListOf<NoteItem>()
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { list.add(NoteItem.from(it)) }
            }
            list
        }.onSuccess {
            notes = it
            connected = true
        }
    }

    suspend fun addNote(text: String): Result<NoteItem> {
        val body = JSONObject().put("text", text.trim())
        val result = call {
            NoteItem.from(ApiClient.post("/notes", body).getJSONObject("note"))
        }
        result.onSuccess {
            connected = true
            refreshNotes()
        }
        return result
    }

    suspend fun toggleNote(id: String, done: Boolean): Result<NoteItem> {
        val body = JSONObject().put("done", done)
        val result = call {
            NoteItem.from(ApiClient.patch("/notes/$id", body).getJSONObject("note"))
        }
        result.onSuccess {
            connected = true
            refreshNotes()
        }
        return result
    }

    suspend fun deleteNote(id: String): Result<Unit> {
        val result = call { ApiClient.delete("/notes/$id"); Unit }
        result.onSuccess {
            connected = true
            refreshNotes()
        }
        return result
    }

    /** অ্যাপ সিকিউরিটি → PIN সেট করুন / PIN পরিবর্তন করুন. */
    suspend fun setPin(pin: String): Result<AppSettings> =
        patchSettings(JSONObject().put("pin", pin.trim()))

    /**
     * PIN সরান. An *explicitly empty* string is how the API is told to clear the
     * PIN — a missing key leaves it alone — so the empty string is load-bearing
     * here and must not be optimised away.
     */
    suspend fun clearPin(): Result<AppSettings> =
        patchSettings(JSONObject().put("pin", ""))

    private suspend fun patchSettings(body: JSONObject): Result<AppSettings> {
        val result = call { AppSettings.from(ApiClient.patch("/settings", body)) }
        result.onSuccess {
            settings = it
            connected = true
        }
        return result
    }

    /**
     * প্রোফাইল সেটিংস → মোবাইল নম্বর পরিবর্তন.
     *
     * The number is the login credential, so the write goes through
     * `PATCH /api/profile`, which normalises it and refuses one another account
     * already owns. The profile slice is refreshed afterwards because the drawer
     * header and the gold toolbar both read the number from it — leaving the old
     * one on screen would make a successful change look like it had failed.
     */
    suspend fun changePhone(phone: String): Result<Unit> {
        val body = JSONObject().put("phone", phone.trim())
        val result = call { ApiClient.patch("/profile", body); Unit }
        result.onSuccess {
            connected = true
            refreshSettings()
            refreshProfile()
        }
        return result
    }

    // ---- মাল্টি ব্যবসা ------------------------------------------------------

    /**
     * Points every future request at [id] (or back at the primary when null).
     * The header and the stored preference move together — there is no state in
     * which the app believes it is in one book while asking for another.
     */
    private fun applyBusinessSelection(id: String?) {
        activeBusinessId = id
        ApiClient.businessId = id
        SessionStore.saveBusinessId(id)
    }

    /** Reloads the switcher sheet's list without touching the active book. */
    suspend fun refreshBusinesses() {
        call { BusinessItem.listFrom(ApiClient.get("/businesses")) }.onSuccess {
            businesses = it
            connected = true
        }
    }

    /**
     * Switches books and reloads everything scoped to them.
     *
     * The customer list is deliberately emptied first: the previous book's rows
     * are not the new book's rows, and showing them for a moment would be a
     * lie about which ledger is on screen.
     */
    suspend fun switchBusiness(id: String) {
        if (id == activeBusinessId) return
        applyBusinessSelection(id)
        activeBusinessName = businesses.firstOrNull { it.id == id }?.name ?: activeBusinessName
        customers = emptyList()
        summary = null
        cashbox = null
        stock = emptyList()
        stockSummary = null
        notes = emptyList()
        bootstrap()
    }

    /** '+ নতুন ব্যবসা'. Creates the book and switches straight into it. */
    suspend fun createBusiness(
        name: String,
        category: String = "মুদি বা জেনারেল স্টোর",
        isPersonal: Boolean = false,
    ): Result<BusinessItem> {
        val body = JSONObject()
            .put("name", name.trim())
            .put("category", category)
            .put("isPersonal", isPersonal)
        val result = call {
            BusinessItem.from(ApiClient.post("/businesses", body).getJSONObject("business"))
        }
        result.onSuccess { created ->
            connected = true
            refreshBusinesses()
            if (created.id.isNotBlank()) {
                activeBusinessName = created.name
                switchBusiness(created.id)
            }
        }
        return result
    }

    /** Renames a book. The header follows if it was the active one. */
    suspend fun renameBusiness(id: String, name: String): Result<BusinessItem> {
        val body = JSONObject().put("name", name.trim())
        val result = call {
            BusinessItem.from(ApiClient.patch("/businesses/$id", body).getJSONObject("business"))
        }
        result.onSuccess { updated ->
            connected = true
            refreshBusinesses()
            if (id == activeBusinessId) activeBusinessName = updated.name
        }
        return result
    }

    /**
     * Deletes a book and everything in it. If the deleted book was the active
     * one, the next request would 404, so the selection falls back to the
     * primary the server reports.
     */
    suspend fun deleteBusiness(id: String): Result<Unit> {
        val wasActive = id == activeBusinessId
        val result = call { ApiClient.delete("/businesses/$id"); Unit }
        result.onSuccess {
            connected = true
            refreshBusinesses()
            if (wasActive) {
                applyBusinessSelection(null)
                customers = emptyList()
                summary = null
                cashbox = null
                stock = emptyList()
                stockSummary = null
                bootstrap()
            }
        }
        return result
    }

    // ---- photo upload -----------------------------------------------------

    /**
     * Sends an image the user just took with the camera or picked from the
     * gallery to our own API, which does the signed Cloudinary upload. The
     * device only ever sees the resulting https URL.
     */
    suspend fun uploadImage(dataUri: String, folder: String = "customers"): Result<UploadedImage> {
        val body = JSONObject().put("data", dataUri).put("folder", folder)
        val result = call {
            UploadedImage.from(ApiClient.post("/uploads", body))
        }
        result.onSuccess { connected = true }
        return result
    }

    // ---- writes -----------------------------------------------------------

    /** নতুন কাস্টমার/সাপ্লায়ার form. */
    suspend fun addCustomer(
        name: String,
        phone: String,
        type: String,
        note: String = "",
        photoUrl: String = "",
        photoPublicId: String = "",
    ): Result<CustomerItem> {
        val body = JSONObject()
            .put("name", name)
            .put("phone", phone)
            .put("type", type)
            .put("note", note)
            .put("photoUrl", photoUrl)
            .put("photoPublicId", photoPublicId)
        val result = call {
            CustomerItem.from(ApiClient.post("/customers", body).getJSONObject("customer"))
        }
        result.onSuccess {
            connected = true
            refreshHome()
        }
        return result
    }

    /**
     * Edit screen. Sends the photo fields only when they changed, so an
     * untouched photo is never needlessly re-uploaded or destroyed.
     */
    suspend fun updateCustomer(
        id: String,
        name: String,
        phone: String,
        type: String,
        note: String,
        photoUrl: String? = null,
        photoPublicId: String? = null,
    ): Result<CustomerItem> {
        val body = JSONObject()
            .put("name", name)
            .put("phone", phone)
            .put("type", type)
            .put("note", note)
        if (photoUrl != null) body.put("photoUrl", photoUrl)
        if (photoPublicId != null) body.put("photoPublicId", photoPublicId)

        val result = call {
            CustomerItem.from(ApiClient.patch("/customers/$id", body).getJSONObject("customer"))
        }
        result.onSuccess {
            connected = true
            refreshHome()
        }
        return result
    }

    /**
     * Ledger form. `box` is "gave" for the দিলাম/বেচা field and "got" for পেলাম;
     * the server maps it to the right ledger kind for this customer's type.
     */
    suspend fun addTransaction(
        customerId: String,
        box: String,
        amount: String,
        description: String,
        date: Date? = null,
    ): Result<LedgerData> {
        val body = JSONObject()
            .put("box", box)
            .put("amount", amount)
            .put("description", description)
        // Omitted means "now": the server defaults a missing date to the current
        // time, so leaving this null preserves the pre-existing behaviour exactly.
        if (date != null) body.put("date", toWireDate(date))
        val result = call {
            ApiClient.post("/customers/$customerId/transactions", body)
            LedgerData.from(ApiClient.get("/customers/$customerId"))
        }
        result.onSuccess {
            connected = true
            refreshHome()
            refreshCashbox()
        }
        return result
    }

    /** ক্যাশ বেচা / খরচ / মালিক দিল / মালিক নিল forms. */
    suspend fun addCashboxEntry(
        kind: String,
        amount: String,
        description: String,
        date: Date? = null,
    ): Result<CashboxDashboard> {
        val body = JSONObject()
            .put("kind", kind)
            .put("amount", amount)
            .put("description", description)
        // Omitted means "now", exactly as for [addTransaction]: the server fills in
        // the current time when the field is absent.
        if (date != null) body.put("date", toWireDate(date))
        val result = call {
            ApiClient.post("/cashbox/entries", body)
            CashboxDashboard.from(ApiClient.get("/cashbox"))
        }
        result.onSuccess {
            connected = true
            cashbox = it
            refreshHome()
        }
        return result
    }

    /** টালিপে একাউন্ট খুলুন. */
    suspend fun openWalletAccount(): Result<WalletData> {
        val result = call {
            ApiClient.post("/wallet/open-account")
            WalletData.from(ApiClient.get("/wallet"))
        }
        result.onSuccess {
            connected = true
            wallet = it
        }
        return result
    }

    /**
     * 'নতুন পণ্য'. Numbers travel as strings: the server's validator accepts
     * Bengali digits and "৳ 1,250.50" and normalises them, so a shopkeeper
     * typing ১২৩ gets 123 rather than a validation error. A blank field means
     * zero, which the server treats as "not known yet" rather than missing.
     */
    suspend fun addStockItem(
        name: String,
        unit: String,
        purchasePrice: String,
        salePrice: String,
        openingStock: String,
        lowStockThreshold: String,
        note: String = "",
    ): Result<StockItem> {
        val body = stockBody(
            name, unit, purchasePrice, salePrice, openingStock, lowStockThreshold, note,
        )
        val result = call { StockItem.from(ApiClient.post("/stock", body).getJSONObject("item")) }
        result.onSuccess {
            connected = true
            refreshStock()
        }
        return result
    }

    /**
     * Edit form. Every field is sent, so the request is a full replace of the
     * editable surface — the server still only touches the keys present, which
     * is what keeps a future partial caller safe.
     */
    suspend fun updateStockItem(
        id: String,
        name: String,
        unit: String,
        purchasePrice: String,
        salePrice: String,
        openingStock: String,
        lowStockThreshold: String,
        note: String = "",
    ): Result<StockItem> {
        val body = stockBody(
            name, unit, purchasePrice, salePrice, openingStock, lowStockThreshold, note,
        )
        val result = call {
            StockItem.from(ApiClient.patch("/stock/$id", body).getJSONObject("item"))
        }
        result.onSuccess {
            connected = true
            refreshStock()
        }
        return result
    }

    /**
     * স্টক ইন / স্টক আউট.
     *
     * Movements are append-only: a mistake is corrected by recording the
     * opposite movement, so there is no edit path here and the quantity can
     * always be recomputed from the log. The refreshed item comes back from the
     * server, so the detail screen never has to add the numbers up itself.
     */
    suspend fun addStockMovement(
        itemId: String,
        direction: String,
        quantity: String,
        unitCost: String,
        note: String = "",
        date: Date? = null,
    ): Result<StockDetail> {
        val body = JSONObject()
            .put("direction", direction)
            .put("quantity", quantity.trim())
            .put("unitCost", unitCost.trim().ifBlank { "0" })
            .put("note", note.trim())
        // Omitted means "now", exactly as for transactions and cash entries.
        if (date != null) body.put("date", toWireDate(date))
        val result = call {
            ApiClient.post("/stock/$itemId/movements", body)
            StockDetail.from(ApiClient.get("/stock/$itemId"))
        }
        result.onSuccess {
            connected = true
            refreshStock()
        }
        return result
    }

    /** Deletes a product and its entire movement history. */
    suspend fun deleteStockItem(id: String): Result<Unit> {
        val result = call { ApiClient.delete("/stock/$id"); Unit }
        result.onSuccess {
            connected = true
            // Drop the row immediately so the list cannot show a product that is
            // already gone, then reconcile with the server.
            stock = stock.filterNot { it.id == id }
            refreshStock()
        }
        return result
    }

    private fun stockBody(
        name: String,
        unit: String,
        purchasePrice: String,
        salePrice: String,
        openingStock: String,
        lowStockThreshold: String,
        note: String,
    ): JSONObject = JSONObject()
        .put("name", name.trim())
        .put("unit", unit.trim().ifBlank { "পিস" })
        .put("purchasePrice", purchasePrice.trim().ifBlank { "0" })
        .put("salePrice", salePrice.trim().ifBlank { "0" })
        .put("openingStock", openingStock.trim().ifBlank { "0" })
        .put("lowStockThreshold", lowStockThreshold.trim().ifBlank { "0" })
        .put("note", note.trim())

    private fun parseCustomers(o: JSONObject): List<CustomerItem> {
        val arr = o.optJSONArray("items") ?: return emptyList()
        val out = ArrayList<CustomerItem>(arr.length())
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { out.add(CustomerItem.from(it)) }
        }
        return out
    }
}
