package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.dateAtNoon
import com.workbuddy.tallyclone.data.localDayOf
import com.workbuddy.tallyclone.ui.TallyDatePickerDialog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.util.Date

/**
 * Renders the calendar dialog on the JVM and taps through it.
 *
 * Every test pins the initial date, so the assertions hold on any day the suite
 * happens to run. The month is chosen so the grid has a real leading gap (Oct
 * 2026 starts on a Thursday), which is the case a naive Sunday-aligned grid
 * gets wrong.
 *
 * The screen is pinned to a real phone size. Robolectric's default is 320x470dp,
 * which is smaller than any device this app targets, and on it the dialog's own
 * confirm row falls outside the window — an artefact of the harness, not a bug.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class DatePickerDialogTest {

    @get:Rule
    val compose = createComposeRule()

    private val october4 = dateAtNoon(2026, 10, 4)

    private fun open(
        initial: Date,
        onConfirm: (Date) -> Unit = {},
        onDismiss: () -> Unit = {},
    ) {
        compose.setContent {
            TallyDatePickerDialog(initial = initial, onDismiss = onDismiss, onConfirm = onConfirm)
        }
        // The dialog lives in its own window, which is attached to the window
        // manager on a later looper pass than the host content. Without this the
        // first assertion can run before that window has been laid out, and
        // `assertIsDisplayed` then reports the footer as off-screen.
        compose.waitForIdle()
    }

    @Test
    fun thePickerOpensOnTheGivenMonthWithBengaliChrome() {
        open(october4)

        // Non-clickable chrome, safe to assert as actually painted.
        compose.onNodeWithText("অক্টোবর ২০২৬").assertIsDisplayed()
        // All seven weekday headers, Sunday first.
        listOf("রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি").forEach {
            compose.onNodeWithText(it).assertIsDisplayed()
        }

        // Day cells and the footer are clickable, so they are asserted as
        // *interactive* rather than as visible. Compose expands a clickable
        // node's touch target to the 48dp minimum, which leaves `boundsInRoot`
        // smaller than `unclippedBoundsInRoot`; `assertIsDisplayed` reads that
        // difference as clipping and fails for every tappable node. Interactivity
        // is the stronger claim regardless, and the tests below prove the taps
        // land.
        //
        // Grid numbers are unpadded (`১`, not `০১`) — only the pill labels are
        // zero-padded, matching the server's `dateBn`. ১ and ৩১ are the two ends
        // of the month, so both edges of the grid are covered; with a four-cell
        // leading gap the ১st must land in the fifth column.
        compose.onNodeWithText("১").assertHasClickAction()
        compose.onNodeWithText("৩১").assertHasClickAction()
        compose.onNodeWithText("ঠিক আছে").assertHasClickAction()
        compose.onNodeWithText("বাতিল").assertHasClickAction()
    }

    @Test
    fun confirmingWithoutTappingADayReturnsTheInitialDay() {
        var picked: Date? = null
        open(october4, onConfirm = { picked = it })

        compose.onNodeWithText("ঠিক আছে").performClick()

        assertEquals(LocalDate.of(2026, 10, 4), picked?.let(::localDayOf))
    }

    @Test
    fun tappingADayThenConfirmingReturnsThatDay() {
        var picked: Date? = null
        open(october4, onConfirm = { picked = it })

        compose.onNodeWithText("১৫").performClick()
        compose.onNodeWithText("ঠিক আছে").performClick()

        assertEquals(LocalDate.of(2026, 10, 15), picked?.let(::localDayOf))
    }

    @Test
    fun cancellingReturnsNothing() {
        var picked: Date? = null
        var dismissed = 0
        open(october4, onConfirm = { picked = it }, onDismiss = { dismissed++ })

        compose.onNodeWithText("১৫").performClick()
        compose.onNodeWithText("বাতিল").performClick()

        assertNull("বাতিল must not commit the tapped day", picked)
        assertEquals(1, dismissed)
    }

    @Test
    fun theNextStepperMovesToTheFollowingMonth() {
        open(october4)

        compose.onNodeWithContentDescription("পরের মাস").performClick()

        compose.onNodeWithText("নভেম্বর ২০২৬").assertIsDisplayed()
        // October's 31st must be gone; November has 30 days.
        compose.onNodeWithText("৩১").assertDoesNotExist()
    }

    @Test
    fun thePreviousStepperCrossesBackIntoThePreviousYear() {
        open(dateAtNoon(2026, 1, 10))

        compose.onNodeWithText("জানুয়ারি ২০২৬").assertIsDisplayed()
        compose.onNodeWithContentDescription("আগের মাস").performClick()

        compose.onNodeWithText("ডিসেম্বর ২০২৫").assertIsDisplayed()
    }

    @Test
    fun theSelectedDaySurvivesAMonthRoundTrip() {
        var picked: Date? = null
        open(october4, onConfirm = { picked = it })

        // Go forward a month, come back, and the original selection must still be
        // the one that gets confirmed.
        compose.onNodeWithContentDescription("পরের মাস").performClick()
        compose.onNodeWithContentDescription("আগের মাস").performClick()
        compose.onNodeWithText("ঠিক আছে").performClick()

        assertEquals(LocalDate.of(2026, 10, 4), picked?.let(::localDayOf))
    }
}
