package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodes
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.ui.CashSellScreen
import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * The cash entry form.
 *
 * Two regressions are pinned here. The fields used to carry their labels as
 * placeholders, so a filled form stopped saying what its fields were; and the
 * বিবরণ was a 56dp single-line box that clipped a description after a few words.
 * Both look fine in an empty screenshot, which is why neither was noticed.
 *
 * The third is arithmetic: a withdrawal bigger than the drawer used to go
 * straight through, leaving বর্তমান ক্যাশ negative with nothing having warned.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class CashFormRenderTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private var originalBaseUrl: String? = null
        private lateinit var server: StubServer

        private val CASHBOX = """
            {
              "todaySale":{"raw":0,"display":"০.০০"},
              "currentCash":{"raw":1000,"display":"১,০০০.০০"},
              "todayIn":{"raw":0,"display":"০.০০"},
              "todayOut":{"raw":0,"display":"০.০০"},
              "receivable":{"raw":0,"display":"০.০০"},
              "payable":{"raw":0,"display":"০.০০"},
              "entryCount":0,
              "rows":[]
            }
        """.trimIndent()

        @JvmStatic
        @BeforeClass
        fun start() {
            originalBaseUrl = ApiClient.baseUrl
            server = StubServer { _, path, _ -> if (path.contains("/cashbox")) CASHBOX else "{}" }
            ApiClient.baseUrl = "http://127.0.0.1:${server.port}/api"
        }

        @JvmStatic
        @AfterClass
        fun stop() {
            server.stop()
            originalBaseUrl?.let { ApiClient.baseUrl = it }
        }
    }

    /** A store whose drawer holds ১,০০০.০০, loaded over the wire. */
    private fun loadedStore(): AppStore {
        val store = AppStore()
        runBlocking { store.refreshCashbox() }
        return store
    }

    @Test
    fun theLabelsStayPutOnceTheFieldsAreFilled() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "owner_out", title = "মালিক নিল", amountLabel = "পরিমাণ")
        }

        compose.onNodeWithText("পরিমাণ").assertIsDisplayed()
        compose.onNodeWithText("বিবরণ").assertIsDisplayed()

        // A placeholder label disappears the moment there is a value; a floating
        // one does not. This is the difference the screenshot is asking for.
        compose.onAllNodes(hasSetTextAction())[0].performTextInput("500")
        compose.waitForIdle()
        compose.onNodeWithText("পরিমাণ").assertIsDisplayed()
    }

    @Test
    fun theDescriptionBoxIsTallerThanTheAmountBox() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "owner_out", amountLabel = "পরিমাণ")
        }

        val amountHeight = compose.onAllNodes(hasSetTextAction())[0].fetchSemanticsNode().size.height
        val descHeight = compose.onAllNodes(hasSetTextAction())[1].fetchSemanticsNode().size.height
        assertTrue(
            "the বিবরণ box ($descHeight) must be the multi-line one, not the amount box ($amountHeight)",
            descHeight > amountHeight * 2,
        )
    }

    @Test
    fun theFormHasNoBuiltInKeypad() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "owner_out", amountLabel = "পরিমাণ")
        }
        // The old form pinned a calculator pad; the reference raises the system
        // keyboard instead, which is the only way a multi-line description can
        // be typed at all.
        compose.onAllNodesWithText("AC").assertCountEquals(0)
        compose.onAllNodesWithText("%").assertCountEquals(0)
    }

    @Test
    fun onlyTheSaleFormsCarryADateAndAPhotoPill() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "cash_sale", title = "ক্যাশ বেচা", amountLabel = "পেলাম")
        }
        compose.onNodeWithText("ছবি").assertIsDisplayed()
    }

    @Test
    fun theOwnerFormsCarryNeither() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "owner_out", title = "মালিক নিল", amountLabel = "পরিমাণ")
        }
        compose.onAllNodesWithText("ছবি").assertCountEquals(0)
    }

    @Test
    fun aWithdrawalBiggerThanTheDrawerWarnsFirst() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "expense", title = "খরচ", amountLabel = "দিলাম")
        }

        compose.onAllNodes(hasSetTextAction())[0].performTextInput("9000")
        compose.waitForIdle()
        compose.onNodeWithText("নিশ্চিত").performClick()
        compose.waitForIdle()

        // ৯,০০০ out of a drawer holding ১,০০০ is a shortfall of ৮,০০০.
        compose.onNodeWithText("ক্যাশে ঘাটতি").assertIsDisplayed()
        compose.onNodeWithText("৮,০০০.০০").assertIsDisplayed()
        compose.onNodeWithText("১,০০০.০০").assertIsDisplayed()
        // And the two ways to top the box up.
        compose.onNodeWithText("ক্যাশ বেচা").assertIsDisplayed()
        compose.onNodeWithText("মালিক দিল").assertIsDisplayed()
    }

    @Test
    fun theShortfallDialogOffersToOpenTheFormThatFixesIt() {
        val store = loadedStore()
        val opened = mutableListOf<String>()
        compose.setContent {
            CashSellScreen(
                store = store,
                onBack = {},
                onOpenReport = {},
                onOpenForm = { opened.add(it) },
                kind = "expense",
                title = "খরচ",
                amountLabel = "দিলাম",
            )
        }

        compose.onAllNodes(hasSetTextAction())[0].performTextInput("9000")
        compose.onNodeWithText("নিশ্চিত").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("মালিক দিল").performClick()
        compose.waitForIdle()

        assertEquals(listOf("owner_in"), opened)
    }

    @Test
    fun moneyComingInIsNeverWarnedAbout() {
        val store = loadedStore()
        compose.setContent {
            CashSellScreen(store = store, onBack = {}, onOpenReport = {}, kind = "cash_sale", title = "ক্যাশ বেচা", amountLabel = "পেলাম")
        }

        compose.onAllNodes(hasSetTextAction())[0].performTextInput("9000")
        compose.waitForIdle()
        compose.onNodeWithText("নিশ্চিত").performClick()
        compose.waitForIdle()

        compose.onAllNodesWithText("ক্যাশে ঘাটতি").assertCountEquals(0)
    }
}
