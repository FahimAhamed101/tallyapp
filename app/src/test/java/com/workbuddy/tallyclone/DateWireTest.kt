package com.workbuddy.tallyclone

import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.dateAtNoon
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import java.util.Collections

/**
 * Proves the date pill actually reaches the wire.
 *
 * Everything else about this feature can be green while the date is still lost:
 * the pill can render, be clickable, and update its label, and `AppStore` can
 * still post a body with no `date` key at all — in which case the server stamps
 * "now" and the user's picked day is silently discarded. The only assertion that
 * rules that out is the one on the outgoing JSON.
 *
 * So this test stands up a throwaway HTTP server on loopback, points
 * [ApiClient] at it, and inspects the captured request bodies. No live backend,
 * no device, no extra dependency — `com.sun.net.httpserver` is not on the
 * Android bootclasspath, so the stub below is hand-rolled on [ServerSocket].
 */
class DateWireTest {

    private lateinit var server: StubServer

    /** Captured in [startServer] and put back in [stopServer]. */
    private var originalBaseUrl: String? = null

    /** path -> parsed body, in arrival order. */
    private val captured = Collections.synchronizedList(mutableListOf<Pair<String, JSONObject>>())

    private fun bodiesFor(pathSuffix: String): List<JSONObject> =
        captured.filter { it.first.endsWith(pathSuffix) }.map { it.second }

    @Before
    fun startServer() {
        server = StubServer { method, path, body ->
            if (method == "POST") {
                captured.add(path to JSONObject(body.ifBlank { "{}" }))
            }
            // Only the ledger GET needs a real shape; `LedgerData.from` requires a
            // `customer` object. Everything else can be an empty envelope, because
            // the store reads those with `opt*` and swallows any failure.
            if (path.startsWith("/api/customers/")) {
                """{"customer":{"id":"c1","name":"করিম"},"headline":{},"entries":[]}"""
            } else {
                "{}"
            }
        }
        originalBaseUrl = ApiClient.baseUrl
        ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        ApiClient.token = "test-token"
    }

    /**
     * `ApiClient` is a singleton and Gradle runs every test class in one JVM, so
     * leaving it pointed at a closed port fails whichever class runs next rather
     * than this one. Restore it, exactly as `DatePillTest` does for the same
     * reason.
     */
    @After
    fun stopServer() {
        server.stop()
        ApiClient.token = null
        originalBaseUrl?.let { ApiClient.baseUrl = it }
    }

    @Test
    fun theLedgerFormSendsThePickedDateAsNoonLocal() {
        runBlocking {
            AppStore().addTransaction(
                customerId = "c1",
                box = "got",
                amount = "100",
                description = "probe",
                date = dateAtNoon(2026, 10, 4),
            )
        }

        val body = bodiesFor("/transactions").single()
        assertEquals("2026-10-04T12:00:00", body.getString("date"))
    }

    @Test
    fun theCashFormSendsThePickedDateToo() {
        runBlocking {
            AppStore().addCashboxEntry(
                kind = "cash_sale",
                amount = "50",
                description = "probe",
                date = dateAtNoon(2025, 1, 9),
            )
        }

        val body = bodiesFor("/cashbox/entries").single()
        assertEquals("2025-01-09T12:00:00", body.getString("date"))
    }

    /**
     * The companion to the two tests above, and what keeps them honest.
     *
     * If `AppStore` hard-coded a date, or sent one unconditionally, the
     * assertions above would still pass. This pins the other half of the
     * contract: no date supplied means no `date` key, which is what lets the
     * server fall back to "now" exactly as it did before this feature existed.
     */
    @Test
    fun omittingTheDateLeavesItOffTheWireEntirely() {
        runBlocking {
            AppStore().addTransaction("c1", "got", "100", "probe")
        }

        val body = bodiesFor("/transactions").single()
        assertFalse("a null date must not be serialised", body.has("date"))
    }
}
