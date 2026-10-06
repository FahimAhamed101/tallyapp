package com.workbuddy.tallyclone.data

import com.workbuddy.tallyclone.BuildConfig
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val status: Int, message: String) : Exception(message)

/** Thrown when the bearer token is missing, expired or revoked. */
class UnauthorizedException(message: String) : Exception(message)

/**
 * Minimal JSON-over-HTTP client. Deliberately dependency-free (HttpURLConnection
 * + org.json are both in the platform) so the build stays fast.
 *
 * `baseUrl` defaults to [BuildConfig.API_BASE], which is baked in at build time
 * so retargeting needs no source edit:
 *
 *   ./gradlew assembleDebug -PapiBase=http://127.0.0.1:4000/api
 *   adb reverse tcp:4000 tcp:4000   # then the device reaches your host's server
 *
 * The JVM tests override it at runtime with `-Dapi.base=…` instead, so pointing
 * a suite at a different backend never touches this file either.
 *
 * Every request carries `Authorization: Bearer <token>` once the user has
 * logged in, which is what scopes the data to their own account. Requests also
 * carry `X-Business-Id` when a book has been selected, which scopes them to one
 * of that account's businesses (মাল্টি ব্যবসা); leaving it unset means the
 * server falls back to the account's primary book.
 */
object ApiClient {

    @Volatile
    var baseUrl: String = BuildConfig.API_BASE

    /** Set by SessionStore on startup and on login; null when logged out. */
    @Volatile
    var token: String? = null

    /**
     * The active book (ব্যবসা), or null to let the server use the primary one.
     * Kept in step with the persisted selection by `AppStore`.
     */
    @Volatile
    var businessId: String? = null

    /** Raised when any call comes back 401, so the UI can return to login. */
    @Volatile
    var onUnauthorized: (() -> Unit)? = null

    private const val TIMEOUT_MS = 20000

    fun get(path: String): JSONObject = request("GET", path, null)

    fun post(path: String, body: JSONObject? = null): JSONObject = request("POST", path, body)

    fun patch(path: String, body: JSONObject?): JSONObject = request("PATCH", path, body)

    fun delete(path: String): JSONObject = request("DELETE", path, null)

    private fun request(method: String, path: String, body: JSONObject?): JSONObject {
        val url = URL(baseUrl.trimEnd('/') + path)

        // java.net.HttpURLConnection refuses any verb outside its fixed list, so
        // PATCH throws ProtocolException before a byte leaves the device. Send it
        // as POST with X-HTTP-Method-Override; the server rewrites the verb back.
        val wireMethod = if (method == "PATCH") "POST" else method

        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = wireMethod
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            useCaches = false
            setRequestProperty("Accept", "application/json")
            if (wireMethod != method) setRequestProperty("X-HTTP-Method-Override", method)
            token?.takeIf { it.isNotBlank() }?.let {
                setRequestProperty("Authorization", "Bearer $it")
            }
            businessId?.takeIf { it.isNotBlank() }?.let {
                setRequestProperty("X-Business-Id", it)
            }
        }

        try {
            // POST/PATCH always carry a body so the server never sees a bare request.
            val payload = when {
                body != null -> body
                wireMethod == "POST" -> JSONObject()
                else -> null
            }
            if (payload != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            }

            android.util.Log.d("ApiClient", "REQUEST: $wireMethod $url token=${token?.take(6)} biz=$businessId")
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use(BufferedReader::readText).orEmpty()
            android.util.Log.d("ApiClient", "RESPONSE: $status text=$text")

            if (status !in 200..299) {
                val message = runCatching { JSONObject(text).optString("message") }
                    .getOrNull()
                    ?.takeIf { it.isNotBlank() }
                    ?: "সার্ভার ত্রুটি ($status)"

                if (status == 401) {
                    // The token is dead — tell the UI so it can show the login screen.
                    token = null
                    onUnauthorized?.invoke()
                    throw UnauthorizedException(message)
                }
                throw ApiException(status, message)
            }

            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }
}
