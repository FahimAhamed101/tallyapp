package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.ui.HomeScreen
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Guards the wiring behind the স্টক হিসাব tile.
 *
 * The tile rendered perfectly and did nothing: `HomeScreen`'s `services` list
 * gave it no `key`, so `ServiceCell` received a null click handler and the tile
 * was pure decoration. Every screenshot of the home tab looked identical either
 * way, so the tap has to be performed for real.
 *
 * The two wired tiles are asserted to reach **different** callbacks. A single
 * shared "opened" counter would still pass if both tiles were accidentally
 * routed to the business sheet — which is the exact shape of the bug this file
 * exists to catch.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class StockTileTest {

    @get:Rule
    val compose = createComposeRule()

    private var openedStock = 0
    private var openedBusinesses = 0

    private fun renderHome() {
        compose.setContent {
            HomeScreen(
                store = AppStore(),
                onTabSelected = {},
                onCustomerClick = {},
                onAddCustomer = {},
                onEditCustomer = {},
                onOpenBusinesses = { openedBusinesses++ },
                onOpenStock = { openedStock++ },
            )
        }
    }

    @Test
    fun theStockTileHasAClickAction() {
        renderHome()

        compose.onNodeWithText("স্টক হিসাব").assertHasClickAction()
    }

    @Test
    fun tappingTheStockTileOpensTheStockScreenAndNothingElse() {
        renderHome()

        compose.onNodeWithText("স্টক হিসাব").performClick()
        compose.waitForIdle()

        assertEquals("the tile must reach onOpenStock", 1, openedStock)
        assertEquals("it must not also open the book switcher", 0, openedBusinesses)
    }

    @Test
    fun theTwoWiredTilesRouteToDifferentScreens() {
        renderHome()

        compose.onNodeWithText("মাল্টি ব্যবসা").performClick()
        compose.waitForIdle()
        assertEquals(1, openedBusinesses)
        assertEquals("the business tile must not open stock", 0, openedStock)

        compose.onNodeWithText("স্টক হিসাব").performClick()
        compose.waitForIdle()
        assertEquals(2, openedStock + openedBusinesses)
        assertEquals(1, openedStock)
        assertEquals(1, openedBusinesses)
    }
}
