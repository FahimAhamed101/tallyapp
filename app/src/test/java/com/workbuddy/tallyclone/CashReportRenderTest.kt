package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.ui.CashAccountReportScreen
import com.workbuddy.tallyclone.ui.shiftPeriod
import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * The ক্যাশ হিসাব screen used to draw **eleven** of its rows as the literal
 * "০.০০", across both tabs, and take its two totals from the ক্যাশবক্স
 * dashboard's *today* figures rather than from the period on screen. That
 * renders perfectly and is indistinguishable from correct output in a
 * screenshot, which is why it lasted: the only way to tell a real row from a
 * hard-coded one is to hand the screen numbers it could not have invented and
 * look for them.
 *
 * Every amount below therefore appears nowhere in the source. The fixtures go
 * through [AppStore.refreshCashReport], so the wire shape and the parse are
 * covered by the same run.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class CashReportRenderTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private var originalBaseUrl: String? = null
        private lateinit var server: StubServer

        /** A day whose figures the reference's own screenshots supplied. */
        private val DAY = """
            {
              "period":"day","periodKey":"2026-10-12","periodLabel":"১২ অক্টোবর",
              "canPrev":true,"canNext":false,
              "rows":[
                {"key":"opening","label":"দিনের শুরুরে ক্যাশ","tone":"in","amount":{"raw":1490,"display":"১,৪৯০.০০"}},
                {"key":"cash_sale","label":"ক্যাশ বেচা","tone":"in","amount":{"raw":11080,"display":"১১,০৮০.০০"}},
                {"key":"received","label":"বাকি আদায়","tone":"in","amount":{"raw":0,"display":"০.০০"}},
                {"key":"owner_in","label":"মালিক দিল","tone":"in","amount":{"raw":57788,"display":"৫৭,৭৮৮.০০"}},
                {"key":"cash_purchase","label":"ক্যাশ কেনা","tone":"out","amount":{"raw":5222,"display":"৫,২২২.০০"}},
                {"key":"paid","label":"পেমেন্ট দেয়া","tone":"out","amount":{"raw":0,"display":"০.০০"}},
                {"key":"expense","label":"খরচ","tone":"out","amount":{"raw":5200,"display":"৫,২০০.০০"}},
                {"key":"owner_out","label":"মালিক নিল","tone":"out","amount":{"raw":5322,"display":"৫,৩২২.০০"}}
              ],
              "totalIn":{"raw":70358,"display":"৭০,৩৫৮.০০"},
              "totalOut":{"raw":15744,"display":"১৫,৭৪৪.০০"},
              "balance":{"raw":54614,"display":"৫৪,৬১৪.০০","negative":false},
              "owner":{"gave":{"raw":57788,"display":"৫৭,৭৮৮.০০"},
                       "took":{"raw":5322,"display":"৫,৩২২.০০"},
                       "balance":{"raw":52466,"display":"৫২,৪৬৬.০০","negative":false}}
            }
        """.trimIndent()

        /**
         * The month tab's business-only balance is deliberately negative here.
         * The reference renders that as a green "৫১০.০০" — the magnitude with
         * the sign lost — and a screen that reports money in the drawer when
         * there is none is the bug, not the spec.
         */
        private val MONTH = """
            {
              "period":"month","periodKey":"2026-10","periodLabel":"অক্টোবর",
              "canPrev":true,"canNext":false,
              "rows":[
                {"key":"opening","label":"মাসের শুরুরে ক্যাশ","tone":"in","amount":{"raw":0,"display":"০.০০"}},
                {"key":"cash_sale","label":"ক্যাশ বেচা","tone":"in","amount":{"raw":800,"display":"৮০০.০০"}},
                {"key":"received","label":"বাকি আদায়","tone":"in","amount":{"raw":0,"display":"০.০০"}},
                {"key":"cash_purchase","label":"ক্যাশ কেনা","tone":"out","amount":{"raw":700,"display":"৭০০.০০"}},
                {"key":"paid","label":"পেমেন্ট দেয়া","tone":"out","amount":{"raw":0,"display":"০.০০"}},
                {"key":"expense","label":"খরচ","tone":"out","amount":{"raw":610,"display":"৬১০.০০"}}
              ],
              "totalIn":{"raw":800,"display":"৮০০.০০"},
              "totalOut":{"raw":1310,"display":"১,৩১০.০০"},
              "balance":{"raw":-510,"display":"-৫১০.০০","negative":true},
              "owner":{"gave":{"raw":2500,"display":"২,৫০০.০০"},
                       "took":{"raw":500,"display":"৫০০.০০"},
                       "balance":{"raw":2000,"display":"২,০০০.০০","negative":false}}
            }
        """.trimIndent()

        @JvmStatic
        @BeforeClass
        fun start() {
            originalBaseUrl = ApiClient.baseUrl
            server = StubServer { _, path, _ ->
                when {
                    path.contains("/reports/cash") && path.contains("period=month") -> MONTH
                    path.contains("/reports/cash") -> DAY
                    path.contains("/reports/owner") -> "{}"
                    else -> "{}"
                }
            }
            ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        }

        /** `ApiClient` is a singleton; leaving it pointed at a dead port breaks the next class. */
        @JvmStatic
        @AfterClass
        fun stop() {
            server.stop()
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }
    }

    private fun storeWith(period: String): AppStore {
        val store = AppStore()
        runBlocking { store.refreshCashReport(period, null) }
        return store
    }

    @Test
    fun theDayTabDrawsTheRowsItIsGiven() {
        val store = storeWith("day")
        compose.setContent {
            CashAccountReportScreen(store = store, initialTab = 0, onBack = {})
        }

        // The opening row is the one a hard-coded screen cannot fake: it depends
        // on every movement before this day.
        compose.onNodeWithText("দিনের শুরুরে ক্যাশ").assertIsDisplayed()
        compose.onNodeWithText("১,৪৯০.০০").assertIsDisplayed()
        compose.onNodeWithText("১১,০৮০.০০").assertIsDisplayed()
        compose.onNodeWithText("৫৭,৭৮৮.০০").assertIsDisplayed()

        // The period label comes from the payload too; it used to read "০৬ অক্টোবর".
        compose.onNodeWithText("১২ অক্টোবর").assertIsDisplayed()

        compose.onNodeWithText("৭০,৩৫৮.০০").assertIsDisplayed()
        compose.onNodeWithText("১৫,৭৪৪.০০").assertIsDisplayed()
        compose.onNodeWithText("৫৪,৬১৪.০০").assertIsDisplayed()
    }

    @Test
    fun theDayTabPutsEachRowInItsOwnColumn() {
        val store = storeWith("day")
        compose.setContent {
            CashAccountReportScreen(store = store, initialTab = 0, onBack = {})
        }

        // মালিক দিল is money in on this tab, so it appears once — in the পেলাম
        // column — and not again as a দিলাম row.
        compose.onAllNodesWithText("৫৭,৭৮৮.০০").assertCountEquals(1)
    }

    @Test
    fun theMonthTabDrawsTheOwnerBlockFromThePayload() {
        val store = storeWith("month")
        compose.setContent {
            CashAccountReportScreen(store = store, initialTab = 1, onBack = {})
        }

        compose.onNodeWithText("মাসের শুরুরে ক্যাশ").assertIsDisplayed()
        compose.onNodeWithText("মালিকের ব্যালেন্স").assertIsDisplayed()
        compose.onNodeWithText("২,৫০০.০০").assertIsDisplayed()
        compose.onNodeWithText("২,০০০.০০").assertIsDisplayed()

        // The month table leaves the owner out, so there is no মালিক দিল row.
        compose.onAllNodesWithText("মালিক দিল").assertCountEquals(0)
    }

    @Test
    fun aNegativeBalanceKeepsItsSign() {
        val store = storeWith("month")
        compose.setContent {
            CashAccountReportScreen(store = store, initialTab = 1, onBack = {})
        }
        compose.onNodeWithText("-৫১০.০০").assertIsDisplayed()
    }

    @Test
    fun theTabsUseTheReferenceSpelling() {
        val store = storeWith("day")
        compose.setContent {
            CashAccountReportScreen(store = store, initialTab = 0, onBack = {})
        }
        compose.onNodeWithText("ক্যাশবক্স রিপোর্ট").assertIsDisplayed()
        compose.onNodeWithText("ক্যাশ রিপোর্ট").assertIsDisplayed()
    }

    @Test
    fun switchingTabsAsksForThatTabsCurrentPeriod() {
        val store = storeWith("day")
        val asked = mutableListOf<Pair<Int, String?>>()
        compose.setContent {
            CashAccountReportScreen(
                store = store,
                initialTab = 0,
                onBack = {},
                onLoadPeriod = { tab, key -> asked.add(tab to key) },
            )
        }
        compose.onNodeWithText("ক্যাশ রিপোর্ট").performClick()
        compose.waitForIdle()
        assertEquals(listOf(1 to null), asked)
    }

    // ---- the period arithmetic -------------------------------------------

    @Test
    fun steppingAPeriodCrossesItsBoundary() {
        assertEquals("2026-09", shiftPeriod("month", "2026-10", -1))
        assertEquals("2026-11", shiftPeriod("month", "2026-10", 1))
        // String surgery on "2026-01" would produce "2026-00".
        assertEquals("2025-12", shiftPeriod("month", "2026-01", -1))
        assertEquals("2026-09-30", shiftPeriod("day", "2026-10-01", -1))
        assertEquals("2026-10-13", shiftPeriod("day", "2026-10-12", 1))
    }

    @Test
    fun steppingWithNoPayloadYetAsksForTheCurrentPeriod() {
        // null is passed straight through, which the server reads as "now" —
        // rather than being turned into a date by guesswork.
        assertEquals(null, shiftPeriod("day", null, -1))
        assertEquals(null, shiftPeriod("month", "", 1))
    }
}
