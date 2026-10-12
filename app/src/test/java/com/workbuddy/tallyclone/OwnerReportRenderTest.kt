package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.ui.OwnerReportScreen
import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * মালিকের রিপোর্ট, which used to do two things a report must never do.
 *
 * It invented data: with no owner movements at all it drew a row reading
 * "৫,২১১.০০" and a matching total and balance, so an account that had never
 * seen a single মালিক দিল was shown one. A fabricated figure is worse than an
 * empty screen because the two are indistinguishable.
 *
 * And it listed one row per *entry*. The reference groups by day, which is what
 * makes মোট mean anything.
 *
 * The month in the fixture is সেপ্টেম্বর rather than the current অক্টোবর, so a
 * period label that had been hard-coded into the screen would fail here.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class OwnerReportRenderTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private var originalBaseUrl: String? = null
        private lateinit var server: StubServer

        /** Two days, and ১২ অক্টোবর carries *two* deposits folded into one row. */
        private val REPORT = """
            {
              "periodKey":"2026-09","periodLabel":"সেপ্টেম্বর",
              "canPrev":true,"canNext":false,
              "rows":[
                {"dateLabel":"০৭ সেপ্টেম্বর, ২০২৬","gave":{"raw":2500,"display":"২,৫০০.০০"},"took":{"raw":500,"display":"৫০০.০০"}},
                {"dateLabel":"১২ সেপ্টেম্বর, ২০২৬","gave":{"raw":57788,"display":"৫৭,৭৮৮.০০"},"took":{"raw":5322,"display":"৫,৩২২.০০"}}
              ],
              "totalGave":{"raw":60288,"display":"৬০,২৮৮.০০"},
              "totalTook":{"raw":5822,"display":"৫,৮২২.০০"},
              "balance":{"raw":54466,"display":"৫৪,৪৬৬.০০","negative":false}
            }
        """.trimIndent()

        private val EMPTY = """
            {
              "periodKey":"2026-09","periodLabel":"সেপ্টেম্বর",
              "canPrev":true,"canNext":false,
              "rows":[],
              "totalGave":{"raw":0,"display":"০.০০"},
              "totalTook":{"raw":0,"display":"০.০০"},
              "balance":{"raw":0,"display":"০.০০","negative":false}
            }
        """.trimIndent()

        @JvmStatic
        @BeforeClass
        fun start() {
            originalBaseUrl = ApiClient.baseUrl
            server = StubServer { _, path, _ ->
                if (path.contains("key=empty")) EMPTY else REPORT
            }
            ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        }

        @JvmStatic
        @AfterClass
        fun stop() {
            server.stop()
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }
    }

    private fun storeWith(key: String?): AppStore {
        val store = AppStore()
        runBlocking { store.refreshOwnerReport(key) }
        return store
    }

    @Test
    fun itDrawsOneRowPerDayWithTheSums() {
        val store = storeWith(null)
        compose.setContent { OwnerReportScreen(report = store.ownerReport, onBack = {}) }

        // Both days, each carrying the day's own totals.
        compose.onNodeWithText("০৭ সেপ্টেম্বর, ২০২৬").assertIsDisplayed()
        compose.onNodeWithText("২,৫০০.০০").assertIsDisplayed()
        compose.onNodeWithText("১২ সেপ্টেম্বর, ২০২৬").assertIsDisplayed()
        compose.onNodeWithText("৫৭,৭৮৮.০০").assertIsDisplayed()

        compose.onNodeWithText("৬০,২৮৮.০০").assertIsDisplayed()
        compose.onNodeWithText("৫,৮২২.০০").assertIsDisplayed()
        compose.onNodeWithText("৫৪,৪৬৬.০০").assertIsDisplayed()
    }

    @Test
    fun thePeriodLabelComesFromThePayload() {
        val store = storeWith(null)
        compose.setContent { OwnerReportScreen(report = store.ownerReport, onBack = {}) }
        compose.onNodeWithText("সেপ্টেম্বর").assertIsDisplayed()
        // The screen used to have অক্টোবর baked in.
        compose.onAllNodesWithText("অক্টোবর").assertCountEquals(0)
    }

    @Test
    fun anEmptyMonthDoesNotInventABalance() {
        val store = storeWith("empty")
        compose.setContent { OwnerReportScreen(report = store.ownerReport, onBack = {}) }

        compose.onNodeWithText("এই মাসে কোনো মালিক লেনদেন নেই").assertIsDisplayed()

        // The exact figure the old fallback made up.
        compose.onAllNodesWithText("৫,২১১.০০").assertCountEquals(0)
        // And no date row either — there is nothing to date.
        compose.onAllNodesWithText("১২ সেপ্টেম্বর, ২০২৬").assertCountEquals(0)
    }
}
