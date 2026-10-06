package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.dateAtNoon
import com.workbuddy.tallyclone.data.toBengaliDate
import com.workbuddy.tallyclone.data.toBengaliDateShort
import com.workbuddy.tallyclone.ui.CashSellScreen
import com.workbuddy.tallyclone.ui.LedgerEntryScreen
import org.junit.Assert.assertNotEquals
import org.junit.AfterClass
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.util.Date

/**
 * Guards the wiring behind the date pill on the ledger and ক্যাশ forms.
 *
 * Both pills used to be inert: `onClick = {}` with a hard-coded "০৪ অক্টোবর" /
 * "০৪ অক্টোবর, ২৬" label. They looked right in every screenshot and did nothing,
 * and `addTransaction` never sent a date at all — so the server always stamped
 * "now" no matter what the pill said. The label was a lie twice over.
 *
 * A render test cannot catch that: the pixels are identical. So each pill is
 * tapped for real, the calendar is driven, and the label is asserted to have
 * *changed* to the picked day.
 *
 * The screen is pinned to a real phone size. Robolectric's default is 320x470dp,
 * and on the ক্যাশ screen — which has a five-row keypad pinned to the bottom —
 * the date pill is scrolled out of that viewport, so the injected tap misses it.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class DatePillTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private var originalBaseUrl: String? = null

        @JvmStatic
        @BeforeClass
        fun pointAtNothing() {
            // These screens fire a LaunchedEffect on first composition. Point the
            // client at a closed local port so the call fails instantly instead of
            // waiting on a real network timeout — the tests assert UI state, not
            // data, and the store swallows the failure into `error`.
            originalBaseUrl = ApiClient.baseUrl
            ApiClient.baseUrl = "http://127.0.0.1:1/api"
        }

        /**
         * `ApiClient` is a singleton, so leaving it pointed at a dead port would
         * silently turn another class's live test into a skip.
         */
        @JvmStatic
        @AfterClass
        fun restoreBaseUrl() {
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }
    }

    private val today = LocalDate.now()

    /** The 15th of the current month — present in every month, so the test is
     *  not date-dependent. */
    private fun fifteenth(): Date = dateAtNoon(today.year, today.monthValue, 15)

    private fun renderLedger() {
        compose.setContent {
            LedgerEntryScreen(
                store = AppStore(),
                customerId = "test-customer",
                onBack = {},
                onOpenReport = {},
            )
        }
    }

    private fun renderCash() {
        compose.setContent {
            CashSellScreen(store = AppStore(), onBack = {}, onOpenReport = {})
        }
    }

    // ---- the ledger form --------------------------------------------------

    @Test
    fun theLedgerDatePillIsWired() {
        renderLedger()

        // The regression, stated directly: the pill must have a click action.
        compose.onNodeWithText(toBengaliDateShort(Date())).assertHasClickAction()
    }

    @Test
    fun tappingTheLedgerDatePillOpensTheCalendar() {
        renderLedger()

        compose.onNodeWithText(toBengaliDateShort(Date())).performClick()

        // The picker's own chrome, proving the tap did not fall through.
        compose.onNodeWithText("ঠিক আছে").assertIsDisplayed()
        compose.onNodeWithText("বাতিল").assertIsDisplayed()
    }

    @Test
    fun theLedgerPillAdoptsThePickedDay() {
        renderLedger()
        val todayLabel = toBengaliDateShort(Date())

        compose.onNodeWithText(todayLabel).performClick()
        compose.onNodeWithText("১৫").performClick()
        compose.onNodeWithText("ঠিক আছে").performClick()

        val pickedLabel = toBengaliDateShort(fifteenth())
        compose.onNodeWithText(pickedLabel).assertIsDisplayed()

        // And it is genuinely derived, not a literal that happens to match.
        if (today.dayOfMonth != 15) {
            assertNotEquals("the label did not change with the picked date", todayLabel, pickedLabel)
            compose.onNodeWithText(todayLabel).assertDoesNotExist()
        }
    }

    // ---- the ক্যাশ form ----------------------------------------------------

    @Test
    fun theCashDatePillIsWired() {
        renderCash()

        compose.onNodeWithText(toBengaliDate(Date())).assertHasClickAction()
    }

    @Test
    fun tappingTheCashDatePillOpensTheCalendar() {
        renderCash()

        compose.onNodeWithText(toBengaliDate(Date())).performClick()

        compose.onNodeWithText("ঠিক আছে").assertIsDisplayed()
    }

    @Test
    fun theCashPillAdoptsThePickedDay() {
        renderCash()
        val todayLabel = toBengaliDate(Date())

        compose.onNodeWithText(todayLabel).performClick()
        compose.onNodeWithText("১৫").performClick()
        compose.onNodeWithText("ঠিক আছে").performClick()

        val pickedLabel = toBengaliDate(fifteenth())
        compose.onNodeWithText(pickedLabel).assertIsDisplayed()

        if (today.dayOfMonth != 15) {
            assertNotEquals("the label did not change with the picked date", todayLabel, pickedLabel)
        }
    }
}
