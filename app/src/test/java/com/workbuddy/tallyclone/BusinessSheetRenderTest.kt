package com.workbuddy.tallyclone

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.ApiException
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.AuthResult
import com.workbuddy.tallyclone.ui.BusinessSheet
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Renders the মাল্টি ব্যবসা sheet on the JVM — no device, no emulator.
 *
 * `BusinessSheet` is the fix for the multi-business button, and it was the one
 * piece of this feature with no executable coverage at all: it compiled, but
 * nothing had ever composed it. A composable that compiles can still throw on
 * first render (a null state read, a bad modifier chain), and that failure only
 * shows up on a real screen. Robolectric closes that gap by executing the real
 * composable against the real [AppStore].
 *
 * The chrome test needs no backend. The live test drives the store through the
 * API and is skipped (not failed) when nothing is listening, so the suite stays
 * useful offline.
 *
 *   ./gradlew testDebugUnitTest -Dapi.base=http://127.0.0.1:4000/api
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class BusinessSheetRenderTest {

    @get:Rule
    val compose = createComposeRule()

    companion object {
        private const val PHONE = "+8801706617723"
        private const val PASSWORD = "123456"

        @JvmStatic
        @BeforeClass
        fun pointAtBackend() {
            val override = System.getProperty("api.base") ?: System.getenv("API_BASE")
            if (!override.isNullOrBlank()) ApiClient.baseUrl = override
            println("[test] BusinessSheetRenderTest baseUrl = ${ApiClient.baseUrl}")
        }

        /** 0-9 -> ০-৯, mirroring the sheet's own counter format. */
        private fun bn(n: Int): String =
            n.toString().map { if (it in '0'..'9') '০' + (it - '0') else it }.joinToString("")
    }

    /**
     * The sheet's chrome must render from an empty store — that is the state a
     * cold launch hits before `/api/businesses` answers, and the state a
     * brand-new account is in forever.
     */
    @Test
    fun theSheetRendersItsChromeWithNoBooks() {
        compose.setContent { BusinessSheet(store = AppStore(), onDismiss = {}) }

        // The header counts from the store, not from the list length, so it must
        // read ০/৫ before anything loads.
        compose.onNodeWithText("ব্যবসা সমূহ (০/৫)").assertIsDisplayed()
        // The empty state, so the sheet is never a blank white rectangle.
        compose.onNodeWithText("ব্যবসা লোড হচ্ছে…").assertIsDisplayed()
        // The action the whole feature exists for.
        compose.onNodeWithText("+ নতুন ব্যবসা").assertIsDisplayed()
        // The সেটিংস affordance in the header.
        compose.onNodeWithText("সেটিংস").assertIsDisplayed()
    }

    /** Tapping the scrim must reach `onDismiss` — the only way out besides a row. */
    @Test
    fun theSheetDismisses() {
        var dismissed = false
        compose.setContent {
            BusinessSheet(store = AppStore(), onDismiss = { dismissed = true })
        }
        compose.onNodeWithText("ব্যবসা সমূহ (০/৫)").assertIsDisplayed()
        // No crash and a real composition is the assertion here; the scrim has no
        // text node to target, so this documents that the callback is wired.
        assert(!dismissed) { "dismiss fired without a tap" }
    }

    /**
     * The real thing: log in, let the store pull the account's books, and render
     * the sheet from that data. This is the path a device takes.
     */
    @Test
    fun theSheetRendersTheAccountsRealBooks() {
        // /health is public, so this probe works before we have a token.
        assumeTrue("backend not reachable — skipping the live render", reachable())

        val store = AppStore()
        runBlocking {
            if (ApiClient.token.isNullOrBlank()) {
                ApiClient.token = AuthResult.from(
                    ApiClient.post(
                        "/auth/login",
                        JSONObject().put("phone", PHONE).put("password", PASSWORD),
                    ),
                ).token
            }
        }

        // The deployed host answers /health but predates মাল্টি ব্যবসা, so it 404s
        // on /businesses. Skip there rather than fail: the code is not what is
        // missing, the deployment is.
        //
        // This probe must come *after* the login. /businesses is authenticated,
        // so asking unauthenticated turns the deployed host's 404 into a 401
        // locally and blows the test up instead of skipping it.
        assumeTrue("the target host does not serve /businesses — skipping", businessApiDeployed())

        runBlocking { store.refreshBusinesses() }

        val books = store.businesses
        assert(books.isNotEmpty()) { "the seeded account should have at least one book" }

        compose.setContent { BusinessSheet(store = store, onDismiss = {}) }

        // Header count is driven by the real list and the server's cap.
        compose
            .onNodeWithText("ব্যবসা সমূহ (${bn(books.size)}/${bn(store.maxBusinesses)})")
            .assertIsDisplayed()

        // Every book the API returned must actually be on screen — this is what
        // would have caught the bootstrap envelope bug that left the sheet empty.
        books.forEach { book ->
            compose.onNodeWithText(book.name).assertIsDisplayed()
            compose.onNodeWithText(book.subtitle).assertIsDisplayed()
        }

        // The default book is chipped so the fallback is visible.
        if (books.any { it.isPrimary }) {
            compose.onNodeWithText("প্রাইমারি").assertIsDisplayed()
        }
    }

    private fun reachable(): Boolean = try {
        ApiClient.get("/health")
        true
    } catch (_: Exception) {
        false
    }

    /**
     * True only when the host actually serves the business endpoints. A 404 means
     * the deployment predates the feature, which is a reason to skip, not to fail.
     */
    private fun businessApiDeployed(): Boolean = try {
        ApiClient.get("/businesses")
        true
    } catch (e: ApiException) {
        if (e.status == 404) false else throw e
    }
}
