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
 */
object SessionStore {

    private const val PREFS = "tally_session"
    private const val KEY_TOKEN = "token"
    private const val KEY_USER = "user"
    private const val KEY_PHONE = "last_phone"

    @Volatile
    private var prefs: SharedPreferences? = null

    /** Called once from Application/MainActivity before anything reads a token. */
    fun init(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // Restore the token so a cold start is already authenticated.
        ApiClient.token = token()
    }

    fun token(): String? = prefs?.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun user(): UserAccount? {
        val raw = prefs?.getString(KEY_USER, null) ?: return null
        return runCatching { UserAccount.from(JSONObject(raw)) }.getOrNull()
    }

    /** Pre-fills the login form with whoever used the app last. */
    fun lastPhone(): String = prefs?.getString(KEY_PHONE, "") ?: ""

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
        prefs?.edit()?.remove(KEY_TOKEN)?.remove(KEY_USER)?.apply()
        ApiClient.token = null
    }
}
