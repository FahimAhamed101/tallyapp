package com.workbuddy.tallyclone

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.ui.CashSellScreen
import com.workbuddy.tallyclone.ui.CashboxScreen
import com.workbuddy.tallyclone.ui.LedgerEntryScreen
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * The রিপোর্ট pill appears on three screens and, until now, every one of them was
 * dead: `onClick = {}`. They looked identical to a working button — same fill,
 * same ripple, same icon — and did nothing.
 *
 * The report screens themselves were never missing. All four are built, routed
 * and reachable from the sidebar menu; only these three pills were never
 * connected. These tests pin the connection, because the failure mode is
 * invisible in a screenshot and silent at runtime.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class ReportPillTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        @JvmStatic
        @BeforeClass
        fun pointAtBackend() {
            // These screens fire a load in a LaunchedEffect on first composition.
            // Point that at the local server so the test never reaches out to the
            // deployed API, which would make it slow and flaky.
            val override = System.getProperty("api.base") ?: System.getenv("API_BASE")
            if (!override.isNullOrBlank()) ApiClient.baseUrl = override
        }
    }

    /** ক্যাশবাক্স dashboard — its রিপোর্ট opens the ক্যাশবাক্স রিপোর্ট tab. */
    @Test
    fun theCashboxReportPillIsWired() {
        var opened = 0
        compose.setContent {
            CashboxScreen(
                store = AppStore(),
                onTabSelected = {},
                onRowClick = {},
                onOpenReport = { opened++ },
            )
        }
        compose.onNodeWithText("রিপোর্ট").performClick()
        compose.waitForIdle()
        assertEquals("the ক্যাশবাক্স dashboard's রিপোর্ট pill must open a report", 1, opened)
    }

    /** Cash entry form — its রিপোর্ট opens the ক্যাশ রিপোর্ট tab. */
    @Test
    fun theCashEntryReportPillIsWired() {
        var opened = 0
        compose.setContent {
            CashSellScreen(
                store = AppStore(),
                onBack = {},
                onOpenReport = { opened++ },
            )
        }
        compose.onNodeWithText("রিপোর্ট").performClick()
        compose.waitForIdle()
        assertEquals("the cash entry form's রিপোর্ট pill must open a report", 1, opened)
    }

    /** A customer's ledger — its রিপোর্ট opens বেচা কেনা হিসাব. */
    @Test
    fun theLedgerReportPillIsWired() {
        var opened = 0
        compose.setContent {
            LedgerEntryScreen(
                store = AppStore(),
                customerId = "000000000000000000000000",
                onBack = {},
                onOpenReport = { opened++ },
            )
        }
        compose.onNodeWithText("রিপোর্ট").performClick()
        compose.waitForIdle()
        assertEquals("the ledger's রিপোর্ট pill must open a report", 1, opened)
    }
}
