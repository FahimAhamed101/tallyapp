package com.workbuddy.tallyclone

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith

/**
 * What the two report screens actually put on the wire.
 *
 * The period a report covers is a *query*, not a path segment, and the whole
 * point of the ‹ › arrows is that they change it — so a screen that rendered
 * correctly while always asking for "now" would look right in every screenshot
 * and be wrong for every month but this one.
 *
 * `ApiClient` is a singleton and Gradle runs every class in one JVM, so the
 * base URL is captured and restored around the class. A wire test that leaves it
 * pointing at a closed loopback port breaks whichever class runs next.
 */
@RunWith(AndroidJUnit4::class)
class CashReportWireTest {

    @get:Rule
    val testName = TestName()

    companion object {
        private var originalBaseUrl: String? = null

        @JvmStatic
        @BeforeClass
        fun capture() {
            originalBaseUrl = ApiClient.baseUrl
        }

        @JvmStatic
        @AfterClass
        fun restore() {
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }
    }

    /** Runs [block] against a throwaway server, then always restores the port. */
    private fun withStub(body: String = "{}", block: (StubServer) -> Unit) {
        val server = StubServer { _, _, _ -> body }
        ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        try {
            block(server)
        } finally {
            server.stop()
        }
    }

    private fun lastPath(server: StubServer): String = server.requests.last().path

    @Test
    fun theDayTabAsksForTheDayItIsShowing() {
        withStub { server ->
            runBlocking { AppStore().refreshCashReport("day", "2026-10-12") }
            val path = lastPath(server)
            assertTrue(path, path.startsWith("/api/reports/cash?"))
            assertTrue(path, path.contains("period=day"))
            assertTrue(path, path.contains("key=2026-10-12"))
        }
    }

    @Test
    fun anOmittedKeyAsksForTheCurrentPeriod() {
        withStub { server ->
            runBlocking { AppStore().refreshCashReport("month", null) }
            val path = lastPath(server)
            assertTrue(path, path.contains("period=month"))
            // No key at all, rather than an empty one the server would have to
            // special-case.
            assertTrue(path, !path.contains("key="))
        }
    }

    @Test
    fun theOwnerReportAsksForItsMonth() {
        withStub { server ->
            runBlocking { AppStore().refreshOwnerReport("2026-09") }
            assertEquals("/api/reports/owner?key=2026-09", lastPath(server))
        }
    }

    @Test
    fun theOwnerReportOmitsTheQueryWhenItWantsTheCurrentMonth() {
        withStub { server ->
            runBlocking { AppStore().refreshOwnerReport(null) }
            assertEquals("/api/reports/owner", lastPath(server))
        }
    }

    @Test
    fun thePayloadIsParsedIncludingTheSignOfABalance() {
        val body = """
            {
              "period":"month","periodKey":"2026-10","periodLabel":"অক্টোবর",
              "canPrev":true,"canNext":false,
              "rows":[
                {"key":"opening","label":"মাসের শুরুরে ক্যাশ","tone":"in","amount":{"raw":0,"display":"০.০০"}},
                {"key":"cash_sale","label":"ক্যাশ বেচা","tone":"in","amount":{"raw":800,"display":"৮০০.০০"}}
              ],
              "totalIn":{"raw":800,"display":"৮০০.০০"},
              "totalOut":{"raw":1310,"display":"১,৩১০.০০"},
              "balance":{"raw":-510,"display":"-৫১০.০০","negative":true},
              "owner":{"gave":{"raw":2500,"display":"২,৫০০.০০"},
                       "took":{"raw":500,"display":"৫০০.০০"},
                       "balance":{"raw":2000,"display":"২,০০০.০০","negative":false}}
            }
        """.trimIndent()

        withStub(body) { _ ->
            val store = AppStore()
            runBlocking { store.refreshCashReport("month", "2026-10") }

            val report = store.cashReport
            assertEquals("month", report?.period)
            assertEquals("2026-10", report?.periodKey)
            assertEquals("অক্টোবর", report?.periodLabel)
            assertEquals(2, report?.rows?.size)
            assertEquals(false, report?.canNext)
            assertEquals("-৫১০.০০", report?.balance)
            assertEquals(true, report?.balanceNegative)
            assertEquals("২,৫০০.০০", report?.owner?.gaveDisplay)
            assertEquals("২,০০০.০০", report?.owner?.balanceDisplay)
        }
    }

    @Test
    fun theDashInAMinusSignIsTheOneTheServerSent() {
        val body = """
            {"period":"month","periodKey":"2026-10","periodLabel":"অক্টোবর",
             "canPrev":true,"canNext":false,"rows":[],
             "totalIn":{"raw":0,"display":"০.০০"},"totalOut":{"raw":0,"display":"০.০০"},
             "balance":{"raw":-1,"display":"-১.০০","negative":true},
             "owner":{"gave":{"raw":0,"display":"০.০০"},"took":{"raw":0,"display":"০.০০"},
                      "balance":{"raw":0,"display":"০.০০","negative":false}}}
        """.trimIndent()

        withStub(body) { _ ->
            val store = AppStore()
            runBlocking { store.refreshCashReport("month", null) }
            assertEquals("-১.০০", store.cashReport?.balance)
            assertEquals(true, store.cashReport?.balanceNegative)
        }
    }
}
