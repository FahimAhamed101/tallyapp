package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.StockDetail
import com.workbuddy.tallyclone.ui.StockDetailScreen
import com.workbuddy.tallyclone.ui.StockFormScreen
import com.workbuddy.tallyclone.ui.StockListScreen
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.AfterClass
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Renders all three স্টক হিসাব screens on the JVM — no device, no emulator.
 *
 * These screens compile into the APK whether or not they can actually compose,
 * and a composable that compiles can still throw on first render (a null state
 * read, an empty list indexed at zero). Robolectric executes the real
 * composables against a real [AppStore], which is the only way to catch that
 * without a phone attached.
 *
 * The screens are deliberately pure renderers — every network call is issued
 * from `AppRoot` — so nothing here needs a backend. The one test that does need
 * `loading` to have settled drives it through a dead loopback port, which fails
 * instantly rather than waiting out a real timeout.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class StockScreenRenderTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private var originalBaseUrl: String? = null

        @JvmStatic
        @BeforeClass
        fun pointAtNothing() {
            originalBaseUrl = ApiClient.baseUrl
            ApiClient.baseUrl = "http://127.0.0.1:1/api"
        }

        /** `ApiClient` is a singleton; leaving it dead would break another class. */
        @JvmStatic
        @AfterClass
        fun restoreBaseUrl() {
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }

        /**
         * A realistic `GET /api/stock/:id` envelope, parsed through the real
         * `from()` methods so this doubles as a check that the DTO reads the
         * server's field names and not a guess at them.
         */
        private fun detailFixture(lowStock: Boolean = false): StockDetail = StockDetail.from(
            JSONObject(
                """
                {
                  "item": {
                    "id": "i1",
                    "name": "মিনিকেট চাল",
                    "unit": "কেজি",
                    "purchasePrice": 100,
                    "salePrice": 130,
                    "openingStock": 120,
                    "lowStockThreshold": 25,
                    "note": "পাইকারি দামে কেনা",
                    "photoUrl": "",
                    "quantity": 105,
                    "costValue": 10500,
                    "saleValue": 13650,
                    "lowStock": $lowStock,
                    "movementCount": 2,
                    "quantityLabel": "স্টক: ১০৫ কেজি",
                    "valueLabel": "মূল্য ৳১০,৫০০.০০",
                    "priceLabel": "ক্রয় ৳১০০.০০ · বিক্রয় ৳১৩০.০০",
                    "lowStockLabel": "${if (lowStock) "স্টক কম" else ""}",
                    "lastMovementLabel": "সর্বশেষ ০৪ অক্টোবর, ২৬"
                  },
                  "movements": [
                    {
                      "id": "m1", "direction": "in", "quantity": 30, "unitCost": 100,
                      "note": "নতুন মাল", "title": "স্টক ইন ৩০ কেজি",
                      "subtitle": "০৪ অক্টোবর, ২৬ · নতুন মাল",
                      "quantityLabel": "+৩০ কেজি", "amountLabel": "৳৩,০০০.০০", "tone": "in"
                    },
                    {
                      "id": "m2", "direction": "out", "quantity": 45, "unitCost": 100,
                      "note": "", "title": "স্টক আউট ৪৫ কেজি",
                      "subtitle": "০৩ অক্টোবর, ২৬",
                      "quantityLabel": "−৪৫ কেজি", "amountLabel": "৳৪,৫০০.০০", "tone": "out"
                    }
                  ]
                }
                """.trimIndent(),
            ),
        )
    }

    private fun renderList(store: AppStore) {
        compose.setContent {
            StockListScreen(store = store, onBack = {}, onOpenItem = {}, onAddItem = {})
        }
    }

    // ---- the list ---------------------------------------------------------

    @Test
    fun theListRendersItsChromeBeforeAnythingLoads() {
        // A cold store is exactly what the screen sees on the frame the tile is
        // tapped, before the first response lands.
        renderList(AppStore())

        compose.onNodeWithText("স্টক হিসাব").assertIsDisplayed()
        // The summary card must not be a blank rectangle while it waits.
        compose.onNodeWithText("পণ্য ০টি").assertIsDisplayed()
        compose.onNodeWithText("স্টকের মূল্য ৳০.০০").assertIsDisplayed()
        compose.onNodeWithText("লোড হচ্ছে…").assertIsDisplayed()
        compose.onNodeWithText("+ নতুন পণ্য").assertHasClickAction()
    }

    @Test
    fun theListFallsBackToItsEmptyState() {
        val store = AppStore()
        // Fails instantly against the dead port and — crucially — clears
        // `loading`, which is the state the empty branch is gated on.
        runBlocking { store.bootstrap() }

        renderList(store)

        compose.onNodeWithText("এখনো কোনো পণ্য যোগ করা হয়নি").assertIsDisplayed()
    }

    @Test
    fun theAddButtonFiresItsCallback() {
        var added = 0
        compose.setContent {
            StockListScreen(
                store = AppStore(),
                onBack = {},
                onOpenItem = {},
                onAddItem = { added++ },
            )
        }

        compose.onNodeWithText("+ নতুন পণ্য").performClick()
        compose.waitForIdle()

        assert(added == 1) { "the add button did not reach onAddItem" }
    }

    // ---- the form ---------------------------------------------------------

    @Test
    fun theCreateFormRendersEmptyAndCannotSubmit() {
        compose.setContent { StockFormScreen(store = AppStore(), item = null, onBack = {}) }

        compose.onNodeWithText("নতুন পণ্য").assertIsDisplayed()
        compose.onNodeWithText("পণ্যের নাম").assertIsDisplayed()
        compose.onNodeWithText("ক্রয় মূল্য").assertIsDisplayed()
        compose.onNodeWithText("বিক্রয় মূল্য").assertIsDisplayed()
        compose.onNodeWithText("প্রারম্ভিক স্টক").assertIsDisplayed()

        // The unit field is the one field with a default, so it renders its
        // value instead of its placeholder. "পিস" is also the server's default,
        // which is what makes an untouched unit field safe to submit.
        compose.onNodeWithText("পিস").assertIsDisplayed()

        // A nameless product must not be submittable — the server would 400 it,
        // and the shopkeeper would rather the button simply stayed grey.
        compose.onNodeWithText("নিশ্চিত").assertIsNotEnabled()
    }

    @Test
    fun theEditFormAdoptsTheItemAndCanSubmit() {
        compose.setContent {
            StockFormScreen(store = AppStore(), item = detailFixture().item, onBack = {})
        }

        compose.onNodeWithText("পণ্য সম্পাদনা").assertIsDisplayed()
        // Enabled proves the form actually read the item's name rather than
        // starting blank — the placeholder would be showing otherwise.
        compose.onNodeWithText("নিশ্চিত").assertIsEnabled()
        compose.onNodeWithText("পণ্যের নাম").assertDoesNotExist()
    }

    // ---- the detail -------------------------------------------------------

    @Test
    fun theDetailRendersTheItemAndItsHistory() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = detailFixture(),
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("মিনিকেট চাল").assertIsDisplayed()
        compose.onNodeWithText("স্টক: ১০৫ কেজি").assertIsDisplayed()
        compose.onNodeWithText("মূল্য ৳১০,৫০০.০০").assertIsDisplayed()
        compose.onNodeWithText("ক্রয় ৳১০০.০০ · বিক্রয় ৳১৩০.০০").assertIsDisplayed()
        compose.onNodeWithText("পাইকারি দামে কেনা").assertIsDisplayed()

        // Both directions of the movement log, newest first.
        compose.onNodeWithText("স্টক ইন ৩০ কেজি").assertIsDisplayed()
        compose.onNodeWithText("স্টক আউট ৪৫ কেজি").assertIsDisplayed()
        compose.onNodeWithText("+৩০ কেজি").assertIsDisplayed()
        compose.onNodeWithText("−৪৫ কেজি").assertIsDisplayed()
    }

    @Test
    fun theDetailShowsTheLowStockBadgeOnlyWhenItIsLow() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = detailFixture(lowStock = true),
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("স্টক কম").assertIsDisplayed()
    }

    /**
     * The other half of the pair above, and what keeps it honest: a screen that
     * hard-coded the badge would satisfy the positive test on its own. Asserting
     * the absence for a healthy item is what makes the pair mean "only when".
     */
    @Test
    fun theDetailHidesTheLowStockBadgeWhenStockIsFine() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = detailFixture(lowStock = false),
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("স্টক কম").assertDoesNotExist()
    }

    @Test
    fun theDetailShowsAnEmptyHistoryRatherThanNothing() {
        val bare = StockDetail.from(
            JSONObject(
                """{"item":{"id":"i2","name":"লবণ","quantityLabel":"স্টক: ০ পিস"},"movements":[]}""",
            ),
        )

        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = bare,
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("এখনো কোনো স্টক মুভমেন্ট নেই").assertIsDisplayed()
    }

    @Test
    fun theDetailReportsAMissingItemInsteadOfCrashing() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = null,
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("পণ্যটি পাওয়া যায়নি").assertIsDisplayed()
    }

    @Test
    fun theStockInButtonOpensTheMovementSheet() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = detailFixture(),
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("স্টক ইন").performClick()

        // The sheet's own chrome — the unit comes from the item, which is what
        // proves the sheet was handed the right product.
        compose.onNodeWithText("স্টক ইন করুন").assertIsDisplayed()
        compose.onNodeWithText("পরিমাণ (কেজি)").assertIsDisplayed()
    }

    @Test
    fun theStockOutButtonOpensTheOutSheet() {
        compose.setContent {
            StockDetailScreen(
                store = AppStore(),
                detail = detailFixture(),
                loading = false,
                onBack = {},
                onEdit = {},
                onReload = {},
            )
        }

        compose.onNodeWithText("স্টক আউট").performClick()

        compose.onNodeWithText("স্টক আউট করুন").assertIsDisplayed()
    }
}
