package com.workbuddy.tallyclone

import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.dateAtNoon
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.Collections

/**
 * Proves the স্টক হিসাব screens reach the wire with the field names the server
 * actually validates.
 *
 * Everything above this layer can be green while the request is still wrong: the
 * list can render, the form can be submittable, and `AppStore` can still post
 * `amount` where `stockMovementCreateSchema` expects `quantity` — in which case
 * the server answers 400 and the user sees "ইনপুট সঠিক নয়" for a form they
 * filled in correctly. Only an assertion on the outgoing JSON rules that out.
 *
 * The stub is [StubServer]: a throwaway HTTP responder on loopback, so no live
 * backend, no device and no extra dependency.
 */
class StockWireTest {

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
            // Every stock endpoint returns an envelope the DTOs can read, so the
            // store's follow-up refresh also succeeds rather than logging an error.
            when {
                path.endsWith("/movements") ->
                    """{"movement":{"id":"m1"},"item":{"id":"i1","name":"চাল"}}"""

                path == "/api/stock" ->
                    """{"item":{"id":"i1","name":"চাল"},"items":[],"summary":{}}"""

                else ->
                    """{"item":{"id":"i1","name":"চাল"},"movements":[]}"""
            }
        }
        originalBaseUrl = ApiClient.baseUrl
        ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        ApiClient.token = "test-token"
    }

    /**
     * `ApiClient` is a singleton and Gradle runs every test class in one JVM, so
     * leaving it pointed at a closed port does not fail *this* class — it fails
     * whichever class happens to run next. That is exactly what happened:
     * `ApiContractTest` passed on an incremental run and then failed wholesale on
     * a forced one, purely because the class order changed.
     */
    @After
    fun stopServer() {
        server.stop()
        ApiClient.token = null
        originalBaseUrl?.let { ApiClient.baseUrl = it }
    }

    @Test
    fun creatingAProductSendsEveryFieldTheServerValidates() {
        runBlocking {
            AppStore().addStockItem(
                name = "মিনিকেট চাল",
                unit = "কেজি",
                purchasePrice = "100",
                salePrice = "130",
                openingStock = "120",
                lowStockThreshold = "25",
                note = "পাইকারি",
            )
        }

        val body = bodiesFor("/stock").single()
        assertEquals("মিনিকেট চাল", body.getString("name"))
        assertEquals("কেজি", body.getString("unit"))
        assertEquals("100", body.getString("purchasePrice"))
        assertEquals("130", body.getString("salePrice"))
        assertEquals("120", body.getString("openingStock"))
        assertEquals("25", body.getString("lowStockThreshold"))
        assertEquals("পাইকারি", body.getString("note"))
    }

    /**
     * The form's optional numbers are sent as "0" rather than "" when left
     * blank. The server normalises "" to 0 as well, so this is not load-bearing
     * for correctness — it is load-bearing for *clarity*: a body that says
     * `"salePrice":"0"` states the intent, while `""` leaves the server to guess
     * whether the field was skipped or emptied.
     */
    @Test
    fun blankNumbersBecomeZeroAndABlankUnitBecomesTheDefault() {
        runBlocking {
            AppStore().addStockItem(
                name = "লবণ",
                unit = "   ",
                purchasePrice = "",
                salePrice = "",
                openingStock = "",
                lowStockThreshold = "",
            )
        }

        val body = bodiesFor("/stock").single()
        assertEquals("পিস", body.getString("unit"))
        assertEquals("0", body.getString("purchasePrice"))
        assertEquals("0", body.getString("salePrice"))
        assertEquals("0", body.getString("openingStock"))
        assertEquals("0", body.getString("lowStockThreshold"))
    }

    /** Bengali digits are passed through: the server's validator converts them. */
    @Test
    fun bengaliDigitsArePassedThroughUntouched() {
        runBlocking {
            AppStore().addStockItem(
                name = "চিনি",
                unit = "কেজি",
                purchasePrice = "১২০",
                salePrice = "১৪০",
                openingStock = "৫০",
                lowStockThreshold = "১০",
            )
        }

        val body = bodiesFor("/stock").single()
        assertEquals("১২০", body.getString("purchasePrice"))
        assertEquals("৫০", body.getString("openingStock"))
    }

    @Test
    fun aMovementCarriesItsDirectionAndQuantity() {
        runBlocking {
            AppStore().addStockMovement(
                itemId = "i1",
                direction = "out",
                quantity = "45",
                unitCost = "100",
                note = "বিক্রি",
            )
        }

        val body = bodiesFor("/movements").single()
        assertEquals("out", body.getString("direction"))
        assertEquals("45", body.getString("quantity"))
        assertEquals("100", body.getString("unitCost"))
        assertEquals("বিক্রি", body.getString("note"))
    }

    @Test
    fun aMovementWithNoDateLeavesItOffTheWire() {
        runBlocking {
            AppStore().addStockMovement("i1", "in", "30", "100")
        }

        val body = bodiesFor("/movements").single()
        assertFalse("a null date must not be serialised", body.has("date"))
    }

    @Test
    fun aMovementWithADateSendsItAsNoonLocal() {
        runBlocking {
            AppStore().addStockMovement(
                itemId = "i1",
                direction = "in",
                quantity = "30",
                unitCost = "100",
                date = dateAtNoon(2026, 10, 4),
            )
        }

        val body = bodiesFor("/movements").single()
        assertEquals("2026-10-04T12:00:00", body.getString("date"))
    }

    /**
     * `HttpURLConnection` refuses any verb outside its fixed list, so
     * `ApiClient` sends the PATCH as a POST carrying `X-HTTP-Method-Override`.
     * If that header ever stopped going out, the server would see a plain POST
     * to `/api/stock/:id` and answer 404 — the edit form would break with no
     * hint as to why.
     */
    @Test
    fun editingAProductGoesOutAsAPostCarryingThePatchOverride() {
        runBlocking {
            AppStore().updateStockItem(
                id = "i1",
                name = "মিনিকেট চাল",
                unit = "কেজি",
                purchasePrice = "105",
                salePrice = "135",
                openingStock = "120",
                lowStockThreshold = "25",
            )
        }

        val body = bodiesFor("/stock/i1").single()
        assertEquals("105", body.getString("purchasePrice"))

        // Looked up by path, not position: `updateStockItem` follows the write
        // with a list refresh, so the last request is that GET, not the edit.
        val edit = server.requests.last { it.path.endsWith("/stock/i1") }
        assertEquals("the edit must go out as POST", "POST", edit.method)
        assertEquals("PATCH", edit.headers["x-http-method-override"])
        assertTrue(
            "the request must still be scoped to the account",
            edit.headers["authorization"]?.startsWith("Bearer ") == true,
        )
    }
}
