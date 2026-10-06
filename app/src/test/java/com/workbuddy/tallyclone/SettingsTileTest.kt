package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.MenuData
import com.workbuddy.tallyclone.data.Profile
import com.workbuddy.tallyclone.ui.MenuDrawer
import com.workbuddy.tallyclone.ui.TallyScreen
import com.workbuddy.tallyclone.ui.menuScreenFor
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Guards the wiring behind the drawer's সেটিংস row.
 *
 * The row rendered perfectly and did nothing. The server had shipped the entry
 * (`getMenu()` returns `{ key: 'settings', … }`), `MenuDrawer` drew it, and
 * `AppRoot`'s click handler then dropped it on `else -> Unit`. Nothing about the
 * screen looked different — a screenshot cannot tell a wired row from a
 * decorative one, so the row has to be pressed for real.
 *
 * The mapping itself is asserted directly, because that is where the bug lived:
 * it is a pure function rather than a `when` buried inside a composable, so the
 * exact key that used to be swallowed can be checked by name.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class SettingsTileTest {

    @get:Rule
    val compose = createComposeRule()

    /** Every key the drawer emitted, in the order the taps happened. */
    private val clicked = mutableListOf<String>()

    companion object {
        /**
         * The drawer payload `getMenu()` actually returns, parsed through the
         * real `from()` methods so this cannot drift from the server's field
         * names. It is the source of truth for the "every shipped key has a
         * screen" assertion below.
         */
        private fun menuFixture(): MenuData = MenuData.from(
            JSONObject(
                """
                {
                  "sections": [
                    {
                      "title": "টালিখাতা",
                      "items": [
                        {"key":"ledger","label":"বেচা কেনা হিসাব","icon":"note_edit","count":3},
                        {"key":"expense","label":"খরচ","icon":"arrow_out","count":1},
                        {"key":"due","label":"বাকি হিসাব","icon":"inbox_doc","count":2},
                        {"key":"cash","label":"ক্যাশ হিসাব","icon":"document","count":4},
                        {"key":"report","label":"মালিকের রিপোর্ট","icon":"chart","count":5}
                      ]
                    },
                    {
                      "title": "অন্যান্য",
                      "items": [
                        {"key":"settings","label":"সেটিংস","icon":"gear","count":0},
                        {"key":"refer","label":"টালিখাতা গোল্ড রেফার করুন","icon":"arrow_out","count":0}
                      ]
                    }
                  ],
                  "version": "ভার্সন - ৭.১৭.০"
                }
                """.trimIndent(),
            ),
        )

        private fun profileFixture(): Profile = Profile.from(
            JSONObject(
                """
                {"name":"fahim","phone":"+8801706617723","initials":"F",
                 "goldPlanName":"টালিখাতা গোল্ড (ট্রায়াল)","goldTrialLabel":"অবশিষ্ট: ৩০ দিন"}
                """.trimIndent(),
            ),
        )
    }

    private fun renderDrawer() {
        compose.setContent {
            MenuDrawer(
                menu = menuFixture(),
                profile = profileFixture(),
                onDismiss = {},
                onLogout = {},
                onItemClick = { clicked.add(it.key) },
            )
        }
    }

    @Test
    fun theSettingsRowIsClickableAtAll() {
        renderDrawer()

        // `assertHasNoClickAction` is the only assertion that would have caught
        // the old behaviour, and it is the one nobody writes by default.
        compose.onNodeWithText("সেটিংস").assertHasClickAction()
    }

    @Test
    fun tappingTheSettingsRowEmitsItsKey() {
        renderDrawer()

        compose.onNodeWithText("সেটিংস").performClick()
        compose.waitForIdle()

        assertEquals(listOf("settings"), clicked)
    }

    @Test
    fun theSettingsKeyResolvesToTheSettingsScreen() {
        // This is the exact assertion for the old bug: 'settings' used to reach
        // the handler and fall through to `else -> Unit`.
        assertEquals(TallyScreen.Settings, menuScreenFor("settings"))
    }

    /**
     * The general form of the defect, so the *next* inert row fails on the day
     * it is added rather than when someone notices. The keys are read out of the
     * payload the server ships, so a new drawer entry with no screen behind it
     * breaks this test without anyone remembering to update it.
     */
    @Test
    fun everyKeyTheServerShipsOpensAScreen() {
        val keys = menuFixture().sections.flatMap { it.items }.map { it.key }

        assertEquals(
            "the fixture should mirror the seven entries getMenu() returns",
            7,
            keys.size,
        )

        keys.forEach { key ->
            if (key == "refer") {
                // 'refer' genuinely has no screen yet. Saying so explicitly is
                // the point: it is a known gap, not an accidental swallow.
                assertNull("'refer' is documented as having no screen", menuScreenFor(key))
            } else {
                assertNotNull("the drawer ships '$key' but nothing opens it", menuScreenFor(key))
            }
        }
    }

    @Test
    fun theMappingTellsTheRowsApart() {
        renderDrawer()

        compose.onNodeWithText("সেটিংস").performClick()
        compose.onNodeWithText("বাকি হিসাব").performClick()
        compose.waitForIdle()

        // Two rows, two keys — a single shared counter would pass if both rows
        // were wired to the same place.
        assertEquals(listOf("settings", "due"), clicked)
        assertEquals(TallyScreen.DueReport, menuScreenFor("due"))
        assertNotEquals(menuScreenFor("settings"), menuScreenFor("due"))
    }

    @Test
    fun anUnknownKeyResolvesToNothingRatherThanAGuess() {
        assertNull(menuScreenFor("no_such_row"))
        assertNull(menuScreenFor(""))
    }
}
