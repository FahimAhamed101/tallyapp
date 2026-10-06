package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHasNoClickAction
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
 * Guards the wiring behind the মাল্টি ব্যবসা tile.
 *
 * This is the regression that started the whole feature: the tile rendered
 * perfectly and did nothing, because `ServiceCell` had no click handler at all.
 * A screenshot cannot catch that — the grid looks identical either way — so the
 * tap has to be performed for real.
 *
 * The grid is deliberately half-wired: মাল্টি ব্যবসা and স্টক হিসাব open screens,
 * and the other six tiles stay decorative, exactly as in the reference app. That
 * intent is asserted too, because "wire up everything" is the obvious-looking
 * change that would quietly start opening blank screens.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class MultiBusinessTileTest {

    @get:Rule
    val compose = createComposeRule()

    /** Renders the home tab with every callback stubbed but the one under test. */
    private fun renderHome(
        onOpenBusinesses: () -> Unit = {},
        onOpenStock: () -> Unit = {},
    ) {
        compose.setContent {
            HomeScreen(
                store = AppStore(),
                onTabSelected = {},
                onCustomerClick = {},
                onAddCustomer = {},
                onEditCustomer = {},
                onOpenBusinesses = onOpenBusinesses,
                onOpenStock = onOpenStock,
            )
        }
    }

    @Test
    fun tappingTheMultiBusinessTileOpensTheSheet() {
        var opened = 0
        renderHome(onOpenBusinesses = { opened++ })

        compose.onNodeWithText("মাল্টি ব্যবসা").performClick()
        compose.waitForIdle()

        assertEquals("tapping the tile must reach onOpenBusinesses", 1, opened)
    }

    @Test
    fun theWiredTilesRespondAndTheDecorativeOnesDoNot() {
        renderHome()

        // The two tiles that must respond.
        compose.onNodeWithText("মাল্টি ব্যবসা").assertHasClickAction()
        compose.onNodeWithText("স্টক হিসাব").assertHasClickAction()

        // A sample of the decorative ones — if any of these gains a click action,
        // the grid has been wired up by accident and will open blank screens.
        compose.onNodeWithText("QR কোড").assertHasNoClickAction()
        compose.onNodeWithText("ডাটা ব্যাকআপ").assertHasNoClickAction()
        compose.onNodeWithText("টালি-মেসেজ").assertHasNoClickAction()
    }

    /** Tapping a decorative tile must not fire the sheet — it has no action at all. */
    @Test
    fun theDecorativeTilesDoNotOpenTheSheet() {
        var opened = 0
        renderHome(onOpenBusinesses = { opened++ })

        // `performClick` on a node with no click action throws, which is itself the
        // proof the tile is inert; assert the absence explicitly instead.
        //
        // Only labels unique to the grid can be used here. `ক্যাশবক্স` is both a
        // grid tile *and* a bottom-nav tab (HomeScreen renders BottomNav), so
        // `onNodeWithText` matches two nodes and throws — use `onAllNodesWithText`
        // if that collision ever has to be targeted.
        compose.onNodeWithText("ব্যবসার নোট").assertHasNoClickAction()
        compose.onNodeWithText("গ্রুপ তাগাদা").assertHasNoClickAction()
        compose.waitForIdle()

        assertEquals("no decorative tile may open the sheet", 0, opened)
    }
}
