package com.workbuddy.tallyclone.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Persists the login between app launches.
 *
 * Only the bearer token and the public account fields are stored — never a
 * password. The token is pushed into [ApiClient] so every request is
 * authenticated, and cleared the moment the server rejects it.
 *
 * The selected business (মাল্টি ব্যবসা) is stored here too, so reopening the app
 * lands you back in the book you were last working in rather than the primary.
 * The server validates it on every request, and [AppStore.bootstrap] drops a
 * selection the server no longer recognises.
 */
object SessionStore {

    private const val PREFS = "tally_session"
    private const val KEY_TOKEN = "token"
    private const val KEY_USER = "user"
    private const val KEY_PHONE = "last_phone"
    private const val KEY_BUSINESS = "business_id"

    @Volatile
    private var prefs: SharedPreferences? = null

    /** Called once from Application/MainActivity before anything reads a token. */
    fun init(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // Restore the token so a cold start is already authenticated.
        ApiClient.token = token()
        // …and the book, so the first requests are already scoped to it.
        ApiClient.businessId = businessId()
    }

    fun token(): String? = prefs?.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun user(): UserAccount? {
        val raw = prefs?.getString(KEY_USER, null) ?: return null
        return runCatching { UserAccount.from(JSONObject(raw)) }.getOrNull()
    }

    /** Pre-fills the login form with whoever used the app last. */
    fun lastPhone(): String = prefs?.getString(KEY_PHONE, "") ?: ""

    /** The book last selected on this device, or null for "use the primary". */
    fun businessId(): String? = prefs?.getString(KEY_BUSINESS, null)?.takeIf { it.isNotBlank() }

    /**
     * Remembers which book is active. Passing null clears the selection, which
     * makes every request fall back to the account's primary business.
     */
    fun saveBusinessId(id: String?) {
        val clean = id?.takeIf { it.isNotBlank() }
        prefs?.edit()?.let { editor ->
            if (clean == null) editor.remove(KEY_BUSINESS) else editor.putString(KEY_BUSINESS, clean)
            editor.apply()
        }
        ApiClient.businessId = clean
    }

    fun save(token: String, user: UserAccount) {
        val json = JSONObject()
            .put("id", user.id)
            .put("name", user.name)
            .put("phone", user.phone)
            .put("photoUrl", user.photoUrl)
            .toString()

        prefs?.edit()
            ?.putString(KEY_TOKEN, token)
            ?.putString(KEY_USER, json)
            ?.putString(KEY_PHONE, user.phone)
            ?.apply()

        ApiClient.token = token
    }

    /** Refreshes the cached account details without touching the token. */
    fun saveUser(user: UserAccount) {
        val json = JSONObject()
            .put("id", user.id)
            .put("name", user.name)
            .put("phone", user.phone)
            .put("photoUrl", user.photoUrl)
            .toString()
        prefs?.edit()?.putString(KEY_USER, json)?.putString(KEY_PHONE, user.phone)?.apply()
    }

    fun clear() {
        prefs?.edit()?.remove(KEY_TOKEN)?.remove(KEY_USER)?.remove(KEY_BUSINESS)?.apply()
        ApiClient.token = null
        ApiClient.businessId = null
    }
}
