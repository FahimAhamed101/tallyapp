package com.workbuddy.tallyclone.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

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

    /** Cold start: one round trip for the static-ish slices, then the lists. */
    suspend fun bootstrap() {
        loading = true
        error = null
        val result = call {
            Triple(
                Bootstrap.from(ApiClient.get("/bootstrap")),
                ApiClient.get("/customers"),
                CashboxDashboard.from(ApiClient.get("/cashbox")),
            )
        }
        result.onSuccess { (boot, customerList, cash) ->
            // The server is the authority on who we are (e.g. after a rename).
            boot.user.takeIf { it.id.isNotBlank() }?.let {
                user = it
                SessionStore.saveUser(it)
            }
            profile = boot.profile
            summary = boot.summary
            wallet = boot.wallet
            menu = boot.menu
            customers = parseCustomers(customerList)
            cashbox = cash
            connected = true
            error = null
        }
        loading = false
    }

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
    ): Result<LedgerData> {
        val body = JSONObject()
            .put("box", box)
            .put("amount", amount)
            .put("description", description)
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
    ): Result<CashboxDashboard> {
        val body = JSONObject()
            .put("kind", kind)
            .put("amount", amount)
            .put("description", description)
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

    private fun parseCustomers(o: JSONObject): List<CustomerItem> {
        val arr = o.optJSONArray("items") ?: return emptyList()
        val out = ArrayList<CustomerItem>(arr.length())
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { out.add(CustomerItem.from(it)) }
        }
        return out
    }
}
