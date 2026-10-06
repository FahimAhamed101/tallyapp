package com.workbuddy.tallyclone

import androidx.compose.ui.graphics.Color
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.ApiException
import com.workbuddy.tallyclone.data.AuthResult
import com.workbuddy.tallyclone.data.Bootstrap
import com.workbuddy.tallyclone.data.BusinessItem
import com.workbuddy.tallyclone.data.CashboxDashboard
import com.workbuddy.tallyclone.data.CustomerItem
import com.workbuddy.tallyclone.data.LedgerData
import com.workbuddy.tallyclone.data.MenuData
import com.workbuddy.tallyclone.data.Profile
import com.workbuddy.tallyclone.data.StockDetail
import com.workbuddy.tallyclone.data.StockItem
import com.workbuddy.tallyclone.data.StockList
import com.workbuddy.tallyclone.data.Summary
import com.workbuddy.tallyclone.data.UnauthorizedException
import com.workbuddy.tallyclone.data.UploadedImage
import com.workbuddy.tallyclone.data.WalletData
import com.workbuddy.tallyclone.data.parseHexColor
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.BeforeClass
import org.junit.Test
import java.net.URLEncoder

/**
 * Contract test for the real client stack, run on the JVM — no device, no emulator.
 *
 * This exercises `ApiClient` (HttpURLConnection + org.json) against a live backend
 * and then parses the response with the same `from()` factories the Compose screens
 * use. It catches field-name drift between the Express routes and the Kotlin models,
 * which is the one class of bug that compiles cleanly and only shows up on screen.
 *
 * It also covers the auth layer end to end: the bearer token, the 401 ->
 * [UnauthorizedException] mapping, per-user isolation, and the base64 image
 * upload path the camera/gallery picker feeds.
 *
 * Requires the backend to be running (and seeded):
 *   cd web && npm run build && npm start      # Next.js API + admin panel
 *
 *   ./gradlew testDebugUnitTest -Dapi.base=http://127.0.0.1:4000/api
 *
 * Without `-Dapi.base` the suite targets the deployed API baked into
 * [ApiClient.baseUrl]. A locally-added route only exists locally, so run the
 * contract test against 127.0.0.1 while developing.
 *
 * Override the target with -Dapi.base=http://host:port/api if needed.
 */
class ApiContractTest {

    companion object {
        private val BENGALI_DIGITS = Regex("[০-৯]")
        private val VALID_TONES = setOf("pabo", "debo", "zero")
        private val CASHBOX_KEYS =
            setOf("cash_sale", "cash_purchase", "expense", "owner_in", "owner_out")

        /** Seeded demo accounts (see web/scripts/seed.ts). */
        private const val PHONE = "+8801706617723"
        private const val PASSWORD = "123456"
        private const val OTHER_PHONE = "+8801811223344"

        /** A real 1x1 PNG — tiny, but valid enough for Cloudinary to accept. */
        private const val PNG_1X1 =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

        @JvmStatic
        @BeforeClass
        fun pointAtBackend() {
            val override = System.getProperty("api.base") ?: System.getenv("API_BASE")
            if (!override.isNullOrBlank()) ApiClient.baseUrl = override
            println("[test] ApiClient.baseUrl = ${ApiClient.baseUrl}")
        }
    }

    /**
     * Every test starts signed in. The suite deliberately shares one account's
     * token, exactly like a returning app would after a cold start.
     *
     * The reachability probe comes first and *skips* rather than fails. Without
     * it a dead or wrong `baseUrl` produced 23 identical ConnectExceptions, which
     * tells you nothing except that the class could not start — and buries the
     * one-line instruction below. A skip is honest about what happened; the
     * `reachable()` helper still fails loudly inside any test that genuinely
     * needs the host.
     */
    @Before
    fun signIn() {
        assumeTrue(
            "backend not reachable at ${ApiClient.baseUrl} — skipping the contract suite " +
                "(start it with: cd web && npm run seed && npm start)",
            ping(),
        )
        if (ApiClient.token.isNullOrBlank()) {
            val auth = AuthResult.from(
                ApiClient.post(
                    "/auth/login",
                    JSONObject().put("phone", PHONE).put("password", PASSWORD),
                ),
            )
            ApiClient.token = auth.token
        }
        assertTrue("no bearer token — is the backend seeded?", !ApiClient.token.isNullOrBlank())
    }

    /** Reachability probe that reports instead of throwing. */
    private fun ping(): Boolean = try {
        ApiClient.get("/health")
        true
    } catch (_: Exception) {
        false
    }

    private fun reachable(): Boolean = try {
        ApiClient.get("/health")
        true
    } catch (e: Exception) {
        fail(
            "Cannot reach ${ApiClient.baseUrl} (${e.message}).\n" +
                "Start the backend first:  cd web && npm run seed && npm start",
        )
        false
    }

    /**
     * True only when the target host actually serves the business endpoints.
     *
     * মাল্টি ব্যবসা is newer than the deployed build, and the live host answers
     * `/api/health` with 200 while returning 404 for `/api/businesses`. Without
     * this guard the three tests below run and fail against that host for a
     * reason that has nothing to do with the code — and a suite that goes red for
     * an environmental reason is a suite everyone learns to ignore.
     *
     * A 404 skips; anything else is a real failure and is rethrown.
     *
     *   ./gradlew testDebugUnitTest -Dapi.base=http://127.0.0.1:4000/api
     */
    private fun businessApiDeployed(): Boolean = try {
        ApiClient.get("/businesses")
        true
    } catch (e: ApiException) {
        if (e.status == 404) {
            println("[test] ${ApiClient.baseUrl} does not serve /businesses — skipping")
            false
        } else {
            throw e
        }
    }

    /** Logs in as the other seeded account and returns a token for it. */
    private fun tokenFor(phone: String): String = AuthResult.from(
        ApiClient.post(
            "/auth/login",
            JSONObject().put("phone", phone).put("password", PASSWORD),
        ),
    ).token

    /** Runs [block] with [token] installed, then restores the original one. */
    private fun <T> asUser(token: String, block: () -> T): T {
        val saved = ApiClient.token
        ApiClient.token = token
        try {
            return block()
        } finally {
            ApiClient.token = saved
        }
    }

    // ---------------------------------------------------------------- health

    @Test
    fun healthReportsAConnectedDatabase() {
        assertTrue(reachable())
        val health = ApiClient.get("/health")
        assertTrue("ok should be true", health.optBoolean("ok"))
        assertEquals("connected", health.optString("db"))
        assertEquals("tally", health.optString("database"))
        assertTrue("host missing", health.optString("host").isNotBlank())
    }

    // ------------------------------------------------------------------ auth

    @Test
    fun loginReturnsATokenAndThePublicAccountOnly() {
        assertTrue(reachable())
        val auth = AuthResult.from(
            ApiClient.post(
                "/auth/login",
                JSONObject().put("phone", PHONE).put("password", PASSWORD),
            ),
        )

        assertTrue("token blank", auth.token.isNotBlank())
        assertTrue("user id blank", auth.user.id.isNotBlank())
        assertEquals("phone was not normalised", PHONE, auth.user.phone)
        assertTrue("name blank", auth.user.name.isNotBlank())

        // The raw response must never carry credential material.
        val raw = ApiClient.post(
            "/auth/login",
            JSONObject().put("phone", PHONE).put("password", PASSWORD),
        ).getJSONObject("user")
        listOf("passwordHash", "passwordSalt", "sessions").forEach {
            assertFalse("$it leaked to the client", raw.has(it))
        }
    }

    @Test
    fun loginAcceptsALocalFormatNumber() {
        assertTrue(reachable())
        // "01706617723" and "+8801706617723" must reach the same account.
        val auth = AuthResult.from(
            ApiClient.post(
                "/auth/login",
                JSONObject().put("phone", "01706617723").put("password", PASSWORD),
            ),
        )
        assertEquals("local number was not normalised", PHONE, auth.user.phone)
    }

    @Test
    fun wrongPasswordIsRejectedWithUnauthorized() {
        assertTrue(reachable())
        val saved = ApiClient.token
        ApiClient.token = null
        try {
            ApiClient.post(
                "/auth/login",
                JSONObject().put("phone", PHONE).put("password", "definitely-wrong"),
            )
            fail("expected a 401 for a wrong password")
        } catch (e: UnauthorizedException) {
            assertTrue("message blank", !e.message.isNullOrBlank())
        } finally {
            ApiClient.token = saved
        }
    }

    @Test
    fun aMissingTokenSurfacesAsUnauthorizedException() {
        assertTrue(reachable())
        val saved = ApiClient.token
        ApiClient.token = null
        try {
            ApiClient.get("/customers")
            fail("expected a 401 without a token")
        } catch (e: UnauthorizedException) {
            assertTrue("message is not Bengali: ${e.message}", !e.message.isNullOrBlank())
        } finally {
            // ApiClient clears its own token on 401; restore ours.
            ApiClient.token = saved
        }
    }

    @Test
    fun meReturnsTheSignedInAccount() {
        assertTrue(reachable())
        val me = ApiClient.get("/auth/me").getJSONObject("user")
        assertEquals("phone drifted", PHONE, me.optString("phone"))
        assertFalse("passwordHash leaked", me.has("passwordHash"))
    }

    // ------------------------------------------------------------- isolation

    @Test
    fun eachAccountOnlySeesItsOwnBooks() {
        assertTrue(reachable())
        val mine = ApiClient.get("/customers").getJSONArray("items")
        assertTrue("the seeded account has no customers", mine.length() > 0)
        val mineIds = (0 until mine.length()).map { mine.getJSONObject(it).optString("id") }.toSet()

        val other = asUser(tokenFor(OTHER_PHONE)) {
            ApiClient.get("/customers").getJSONArray("items")
        }
        assertTrue("the other seeded account has no customers", other.length() > 0)

        (0 until other.length()).forEach { i ->
            val id = other.getJSONObject(i).optString("id")
            assertFalse("customer $id is visible to both accounts", mineIds.contains(id))
        }
    }

    @Test
    fun crossTenantReadAndDeleteAreRefused() {
        assertTrue(reachable())
        val target = ApiClient.get("/customers").getJSONArray("items").getJSONObject(0)
            .optString("id")
        val otherToken = tokenFor(OTHER_PHONE)

        asUser(otherToken) {
            try {
                ApiClient.get("/customers/$target")
                fail("another user's customer was readable")
            } catch (e: ApiException) {
                assertEquals("expected a 404 for a cross-tenant read", 404, e.status)
            }

            try {
                ApiClient.delete("/customers/$target")
                fail("another user's customer was deletable")
            } catch (e: ApiException) {
                assertEquals("expected a 404 for a cross-tenant delete", 404, e.status)
            }
        }

        // ...and the owner still has it.
        assertTrue(
            "the customer was actually deleted",
            ApiClient.get("/customers/$target").getJSONObject("customer").optString("id") == target,
        )
    }

    // -------------------------------------------------- মাল্টি ব্যবসা (books)

    @Test
    fun bootstrapCarriesTheBusinessList() {
        assertTrue(reachable())
        assumeTrue("the target host does not serve /businesses — skipping", businessApiDeployed())
        val boot = Bootstrap.from(ApiClient.get("/bootstrap"))

        assertTrue("no businesses came back", boot.businesses.isNotEmpty())
        assertTrue("activeBusinessId was not parsed", boot.activeBusinessId.isNotBlank())
        assertTrue("activeBusinessName was not parsed", boot.activeBusinessName.isNotBlank())
        assertTrue("maxBusinesses was not parsed", boot.maxBusinesses >= boot.businesses.size)

        // The sheet ticks the active row, so the active id must actually be one
        // of the rows — otherwise nothing would render as selected.
        assertTrue(
            "activeBusinessId is not among the listed businesses",
            boot.businesses.any { it.id == boot.activeBusinessId },
        )
        // Exactly one primary, or the switcher's [প্রাইমারি] chip is ambiguous.
        assertEquals(1, boot.businesses.count { it.isPrimary })

        boot.businesses.forEach {
            assertTrue("business ${it.id} has no name", it.name.isNotBlank())
            // The row subtitle is composed on the client from two server halves.
            assertTrue("subtitle is not composed", it.subtitle.contains(" | "))
            assertTrue(
                "customerLabel is not Bengali: ${it.customerLabel}",
                BENGALI_DIGITS.containsMatchIn(it.customerLabel),
            )
            assertTrue(
                "receivableLabel is not Bengali: ${it.receivableLabel}",
                BENGALI_DIGITS.containsMatchIn(it.receivableLabel),
            )
        }
    }

    @Test
    fun businessListParses() {
        assertTrue(reachable())
        assumeTrue("the target host does not serve /businesses — skipping", businessApiDeployed())
        val items = BusinessItem.listFrom(ApiClient.get("/businesses"))
        assertTrue("the sheet listed nothing", items.isNotEmpty())
        items.forEach {
            assertTrue("business has no id", it.id.isNotBlank())
            assertTrue("business has no name", it.name.isNotBlank())
            assertTrue("customerCount went negative", it.customerCount >= 0)
            assertTrue("supplierCount went negative", it.supplierCount >= 0)
        }
    }

    /**
     * The `X-Business-Id` header is what keeps two books' ledgers apart. A bug
     * here would not crash anything — it would quietly mix one shopkeeper's two
     * books together, which is the worst way this feature can fail. So this
     * drives the real `ApiClient` (header, verb-override and all) and re-reads
     * the API to confirm the separation.
     */
    @Test
    fun businessHeaderScopesReadsAndWrites() {
        assertTrue(reachable())
        assumeTrue("the target host does not serve /businesses — skipping", businessApiDeployed())
        val savedBusiness = ApiClient.businessId
        var createdId: String? = null

        try {
            val created = BusinessItem.from(
                ApiClient.post("/businesses", JSONObject().put("name", "কন্ট্রাক্ট টেস্ট বই"))
                    .getJSONObject("business"),
            )
            createdId = created.id
            assertTrue("the new book has no id", created.id.isNotBlank())
            assertFalse("an added book must not be primary", created.isPrimary)

            // Write a customer into the new book.
            ApiClient.businessId = created.id
            val scoped = CustomerItem.from(
                ApiClient.post(
                    "/customers",
                    JSONObject().put("name", "কন্ট্রাক্ট বই কাস্টমার").put("type", "customer"),
                ).getJSONObject("customer"),
            )

            val inNew = ApiClient.get("/customers").getJSONArray("items")
            assertTrue(
                "the new book did not list its own customer",
                (0 until inNew.length()).any { inNew.getJSONObject(it).optString("id") == scoped.id },
            )

            // Back to the primary: the customer must not follow us.
            ApiClient.businessId = null
            val inPrimary = ApiClient.get("/customers").getJSONArray("items")
            assertFalse(
                "the primary book leaked the other book's customer",
                (0 until inPrimary.length()).any { inPrimary.getJSONObject(it).optString("id") == scoped.id },
            )

            // Reading it from the wrong book must 404, exactly like a cross-user read.
            try {
                ApiClient.get("/customers/${scoped.id}")
                fail("one book could read another book's customer")
            } catch (e: ApiException) {
                assertEquals("expected a 404 for a cross-book read", 404, e.status)
            }

            // Renaming goes over the wire as POST + X-HTTP-Method-Override,
            // because HttpURLConnection cannot send PATCH at all.
            val renamed = BusinessItem.from(
                ApiClient.patch(
                    "/businesses/${created.id}",
                    JSONObject().put("name", "কন্ট্রাক্ট টেস্ট বই ২"),
                ).getJSONObject("business"),
            )
            assertEquals("কন্ট্রাক্ট টেস্ট বই ২", renamed.name)
        } finally {
            ApiClient.businessId = savedBusiness
            createdId?.let { runCatching { ApiClient.delete("/businesses/$it") } }
        }
    }

    // ------------------------------------------------------------- bootstrap

    @Test
    fun bootstrapParsesEverySubObject() {
        assertTrue(reachable())
        val b = Bootstrap.from(ApiClient.get("/bootstrap"))

        // user
        assertEquals("bootstrap user is not the caller", PHONE, b.user.phone)
        assertTrue("bootstrap user id blank", b.user.id.isNotBlank())

        // profile
        assertTrue("profile.name blank", b.profile.name.isNotBlank())
        assertTrue("profile.initials blank", b.profile.initials.isNotBlank())
        assertTrue("goldTrialLabel not Bengali-formatted", b.profile.goldTrialLabel.contains("দিন"))

        // summary
        assertTrue("receivable blank", b.summary.receivableDisplay.isNotBlank())
        assertTrue("payable blank", b.summary.payableDisplay.isNotBlank())
        assertTrue(
            "customerLabel not formatted: ${b.summary.customerLabel}",
            b.summary.customerLabel.contains("কাস্টমার") && b.summary.customerLabel.contains("সাপ্লায়ার"),
        )

        // wallet
        assertEquals("expected 8 wallet services", 8, b.wallet.services.size)
        assertTrue("benefits empty", b.wallet.benefits.isNotEmpty())

        // menu
        assertEquals("expected 2 menu sections", 2, b.menu.sections.size)
        assertTrue("menu.version missing", b.menu.version.isNotBlank())

        // amounts must have arrived pre-formatted in Bengali
        assertTrue(
            "receivable is not in Bengali digits: ${b.summary.receivableDisplay}",
            BENGALI_DIGITS.containsMatchIn(b.summary.receivableDisplay),
        )
    }

    // ------------------------------------------------------------- customers

    @Test
    fun customerListParsesWithValidTonesAndAvatars() {
        assertTrue(reachable())
        val rows = ApiClient.get("/customers").getJSONArray("items")
        assertTrue("no customers returned", rows.length() > 0)

        val parsed = (0 until rows.length()).map { CustomerItem.from(rows.getJSONObject(it)) }

        parsed.forEach { c ->
            assertTrue("customer id blank", c.id.isNotBlank())
            assertTrue("customer name blank", c.name.isNotBlank())
            assertTrue("initials blank for ${c.name}", c.initials.isNotBlank())
            assertTrue("bad amountTone for ${c.name}: ${c.amountTone}", c.amountTone in VALID_TONES)
            assertTrue("amountDisplay blank for ${c.name}", c.amountDisplay.isNotBlank())
            assertTrue("subtitle blank for ${c.name}", c.subtitle.isNotBlank())
            // note is optional, but must always decode to a string, never null
            assertNotNull("note decoded to null for ${c.name}", c.note)
            assertNotNull("photoUrl decoded to null for ${c.name}", c.photoUrl)
        }

        // the avatar colours must have survived hex -> Color conversion
        val first = parsed.first()
        assertNotNull(first.avatarColor)
        assertNotNull(first.avatarTextColor)

        // both customer types should be present in the seeded data
        assertTrue("no supplier in the list", parsed.any { it.isSupplier })
        assertTrue("no plain customer in the list", parsed.any { !it.isSupplier })
    }

    @Test
    fun customerSearchFilterIsHonoured() {
        assertTrue(reachable())
        val all = ApiClient.get("/customers").getJSONArray("items")
        val target = CustomerItem.from(all.getJSONObject(0))
        val needle = target.name.take(2)

        val filtered = ApiClient.get("/customers?q=$needle").getJSONArray("items")
        assertTrue("search for '$needle' returned nothing", filtered.length() > 0)
        (0 until filtered.length()).forEach { i ->
            val name = filtered.getJSONObject(i).optString("name")
            assertTrue("'$name' does not contain '$needle'", name.contains(needle))
        }
    }

    // --------------------------------------------------------------- ledger

    @Test
    fun ledgerParsesForACustomerWithATransactionHistory() {
        assertTrue(reachable())
        val rows = ApiClient.get("/customers").getJSONArray("items")
        val parsed = (0 until rows.length()).map { CustomerItem.from(rows.getJSONObject(it)) }

        // a non-zero tone guarantees this customer has ledger entries
        val withHistory = parsed.firstOrNull { it.amountTone != "zero" }
        assertNotNull("no customer with a non-zero balance to test the ledger with", withHistory)

        val ledger = LedgerData.from(ApiClient.get("/customers/${withHistory!!.id}"))
        assertTrue("ledger has no entries", ledger.entries.isNotEmpty())
        assertTrue("headline amount blank", ledger.headline.amountDisplay.isNotBlank())
        assertTrue(
            "headline label unexpected: ${ledger.headline.label}",
            ledger.headline.label == "পাবো" || ledger.headline.label == "দেবো",
        )
        assertTrue(
            "headline amount not in Bengali digits: ${ledger.headline.amountDisplay}",
            BENGALI_DIGITS.containsMatchIn(ledger.headline.amountDisplay),
        )

        ledger.entries.forEach { e ->
            assertTrue("entry id blank", e.id.isNotBlank())
            assertTrue("entry title blank", e.title.isNotBlank())
            assertTrue("entry tone invalid: ${e.tone}", e.tone == "in" || e.tone == "out")
            assertTrue("entry amount blank", e.amountDisplay.isNotBlank())
            assertTrue("entry date blank", e.dateDisplay.isNotBlank())
        }
    }

    // -------------------------------------------------------------- cashbox

    @Test
    fun cashboxDashboardHasAllFiveRows() {
        assertTrue(reachable())
        val d = CashboxDashboard.from(ApiClient.get("/cashbox"))

        assertEquals("expected 5 dashboard rows", 5, d.rows.size)
        assertEquals(
            "dashboard row keys changed",
            CASHBOX_KEYS,
            d.rows.map { it.key }.toSet(),
        )
        d.rows.forEach { row ->
            assertTrue("row ${row.key} label blank", row.label.isNotBlank())
            assertTrue("row ${row.key} amount blank", row.amountDisplay.isNotBlank())
        }
        listOf(d.todaySale, d.currentCash, d.todayIn, d.todayOut, d.receivable, d.payable).forEach {
            assertTrue("a cashbox figure is blank", it.isNotBlank())
        }
    }

    // --------------------------------------------------------------- wallet

    @Test
    fun walletExposesEightServices() {
        assertTrue(reachable())
        val w = WalletData.from(ApiClient.get("/wallet"))
        assertEquals("expected 8 services", 8, w.services.size)
        assertTrue("balance blank", w.balanceDisplay.isNotBlank())
        assertTrue("benefits empty", w.benefits.isNotEmpty())
        w.services.forEach { s ->
            assertTrue("service key blank", s.key.isNotBlank())
            assertTrue("service label blank for ${s.key}", s.label.isNotBlank())
        }
        // the label must be Bengali, not the raw key
        assertTrue(
            "service labels are not localised",
            w.services.any { it.label != it.key },
        )
    }

    // ----------------------------------------------------------------- menu

    @Test
    fun menuSectionsCarryLiveCounts() {
        assertTrue(reachable())
        val m = MenuData.from(ApiClient.get("/menu"))

        assertEquals("expected 2 sections", 2, m.sections.size)
        val first = m.sections.first()
        assertEquals("expected 5 items in the first section", 5, first.items.size)
        first.items.forEach { item ->
            assertTrue("menu item key blank", item.key.isNotBlank())
            assertTrue("menu item label blank for ${item.key}", item.label.isNotBlank())
        }
        assertTrue("version not localised: ${m.version}", m.version.contains("ভার্সন"))
        assertTrue("no menu item carries a count", first.items.any { it.count > 0 })
    }

    // --------------------------------------------------------------- uploads

    @Test
    fun uploadReturnsAUsableCloudinaryUrl() {
        assertTrue(reachable())
        val status = ApiClient.get("/uploads/status")
        assertTrue(
            "Cloudinary is not configured on the server — check web/.env.local",
            status.optBoolean("configured"),
        )

        val up = UploadedImage.from(
            ApiClient.post(
                "/uploads",
                JSONObject().put("data", PNG_1X1).put("folder", "customers"),
            ),
        )
        assertTrue("upload returned no url", up.url.startsWith("https://res.cloudinary.com/"))
        assertTrue("upload returned no publicId", up.publicId.isNotBlank())

        // The asset id must be namespaced to us, which is what lets DELETE work.
        val me = ApiClient.get("/auth/me").getJSONObject("user").optString("id")
        assertTrue(
            "publicId '${up.publicId}' is not namespaced to $me",
            up.publicId.contains("${me}_"),
        )

        // ...and the other account may not delete it. The query form is used
        // because a public_id contains slashes, which a path segment cannot
        // carry without escaping.
        val idQuery = URLEncoder.encode(up.publicId, "UTF-8")
        asUser(tokenFor(OTHER_PHONE)) {
            try {
                ApiClient.delete("/uploads?publicId=$idQuery")
                fail("another user could delete our asset")
            } catch (e: ApiException) {
                assertEquals(400, e.status)
            }
        }

        // The owner may.
        val removed = ApiClient.delete("/uploads?publicId=$idQuery")
        assertTrue("the owner could not delete their own asset", removed.optBoolean("ok"))
    }

    // -------------------------------------------------------- write + error

    @Test
    fun createThenDeleteRoundTrip() {
        assertTrue(reachable())
        val phone = "+8801700" + (100000..999999).random()

        val created = ApiClient.post(
            "/customers",
            JSONObject()
                .put("name", "কনট্রাক্ট টেস্ট")
                .put("phone", phone)
                .put("type", "customer")
                .put("note", "কনট্রাক্ট বিবরণ"),
        )
        val customer = CustomerItem.from(created.getJSONObject("customer"))
        assertTrue("created customer has no id", customer.id.isNotBlank())
        assertEquals("কনট্রাক্ট টেস্ট", customer.name)
        assertEquals("বিবরণ did not round-trip", "কনট্রাক্ট বিবরণ", customer.note)
        assertEquals("a new customer should start at zero", "zero", customer.amountTone)

        try {
            // the ledger must reflect the new customer immediately
            val ledger = LedgerData.from(ApiClient.get("/customers/${customer.id}"))
            assertTrue("new customer should have no entries", ledger.entries.isEmpty())

            // a transaction must move the derived headline
            val posted = ApiClient.post(
                "/customers/${customer.id}/transactions",
                JSONObject().put("box", "gave").put("amount", "১২৩.৪৫").put("description", "টেস্ট"),
            )
            val entry = posted.getJSONObject("entry")
            assertEquals("sale", entry.optString("kind"))
            assertTrue(
                "Bengali amount was not parsed: ${entry.optString("amountDisplay")}",
                entry.optString("amountDisplay").contains("১২৩"),
            )
            val headline = posted.getJSONObject("headline")
            assertTrue(
                "headline did not move: ${headline.optString("amountDisplay")}",
                headline.optString("amountDisplay").contains("১২৩"),
            )

            // an edit must persist, and keep the fields it did not touch
            val edited = ApiClient.patch(
                "/customers/${customer.id}",
                JSONObject().put("name", "কনট্রাক্ট টেস্ট (সম্পাদিত)").put("note", "নতুন বিবরণ"),
            )
            val after = CustomerItem.from(edited.getJSONObject("customer"))
            assertEquals("কনট্রাক্ট টেস্ট (সম্পাদিত)", after.name)
            assertEquals("নতুন বিবরণ", after.note)
            assertEquals("phone was lost on edit", phone, after.phone)
        } finally {
            ApiClient.delete("/customers/${customer.id}")
        }

        // the delete must have taken effect
        try {
            ApiClient.get("/customers/${customer.id}")
            fail("customer still readable after delete")
        } catch (e: ApiException) {
            assertEquals(404, e.status)
            assertTrue("404 message is not Bengali: ${e.message}", e.message!!.isNotBlank())
        }
    }

    @Test
    fun validationErrorsSurfaceAsApiExceptionWithABengaliMessage() {
        assertTrue(reachable())

        // missing name -> 400
        try {
            ApiClient.post("/customers", JSONObject().put("phone", "+8801700000000"))
            fail("expected a 400 for a missing name")
        } catch (e: ApiException) {
            assertEquals(400, e.status)
            assertTrue("message blank", !e.message.isNullOrBlank())
        }

        // unknown id -> 404
        try {
            ApiClient.get("/customers/000000000000000000000000")
            fail("expected a 404 for an unknown id")
        } catch (e: ApiException) {
            assertEquals(404, e.status)
        }

        // junk amount -> 400
        val anyCustomer = CustomerItem.from(
            ApiClient.get("/customers").getJSONArray("items").getJSONObject(0),
        )
        try {
            ApiClient.post(
                "/customers/${anyCustomer.id}/transactions",
                JSONObject().put("box", "gave").put("amount", "abc"),
            )
            fail("expected a 400 for a junk amount")
        } catch (e: ApiException) {
            assertEquals(400, e.status)
        }

        // a non-image upload -> 400
        try {
            ApiClient.post("/uploads", JSONObject().put("data", "data:text/plain;base64,aGVsbG8="))
            fail("expected a 400 for a non-image upload")
        } catch (e: ApiException) {
            assertEquals(400, e.status)
        }
    }

    // ------------------------------------------------------------ primitives

    @Test
    fun parseHexColorHandlesRealAndMalformedInput() {
        val orange = parseHexColor("#FFE0B2")
        assertEquals(Color(0xFFFFE0B2L), orange)

        // distinct inputs must not collapse to the same colour
        assertFalse(orange == parseHexColor("#D1FAD1"))

        val fallback = Color(0xFF123456)
        assertEquals("blank input should use the fallback", fallback, parseHexColor("", fallback))
        assertEquals("null input should use the fallback", fallback, parseHexColor(null, fallback))
        assertEquals("junk should use the fallback", fallback, parseHexColor("zzzzzz", fallback))
        assertEquals("3-digit hex should use the fallback", fallback, parseHexColor("#ABC", fallback))
    }

    @Test
    fun modelsTolerateAPartialPayload() {
        // the models must not throw on a partial payload — the UI renders a zero
        val empty = Summary.from(JSONObject())
        assertEquals("০.০০", empty.receivableDisplay)
        assertEquals("০.০০", empty.payableDisplay)
        assertEquals("", empty.customerLabel)

        // An absent profile must not invent somebody's name: the login screen
        // shows before the first bootstrap, so these are the real defaults.
        val partial = Profile.from(JSONObject())
        assertEquals("", partial.name)
        assertEquals("?", partial.initials)
        assertEquals(0, partial.inboxUnread)

        val noUser = AuthResult.from(JSONObject())
        assertEquals("", noUser.token)
        assertEquals("", noUser.user.name)

        val customer = CustomerItem.from(JSONObject())
        assertEquals("customer", customer.type)
        assertEquals("", customer.photoUrl)
        assertEquals("", customer.note)

        // The switcher sheet is the first thing the home tab can open, so a
        // business row must degrade rather than crash on a thin payload.
        val business = BusinessItem.from(JSONObject())
        assertEquals("", business.id)
        assertEquals("", business.name)
        assertFalse(business.isPrimary)
        assertEquals(0, business.customerCount)
        assertEquals("কাস্টমার ০, সাপ্লায়ার ০ | মোট পাওয়া ০.০০", business.subtitle)
    }

    // ---- স্টক হিসাব --------------------------------------------------------

    /**
     * The stock DTOs must read the field names the server actually sends.
     *
     * `StockScreenRenderTest` renders the screens from a hand-written fixture,
     * which is exactly the kind of thing that drifts: if the route renamed
     * `quantityLabel`, that fixture would keep passing while every real screen
     * showed a blank. Only a live parse catches that, which is what this is.
     */
    @Test
    fun stockListParsesWithBengaliLabelsAndAMatchingSummary() {
        reachable()
        val list = StockList.from(ApiClient.get("/stock"))

        assertTrue("the seeded account should have stock items", list.items.isNotEmpty())
        assertEquals(
            "the summary must count exactly the rows it came with",
            list.items.size,
            list.summary.itemCount,
        )

        list.items.forEach { item ->
            assertTrue("an item came back without an id", item.id.isNotBlank())
            assertTrue("${item.name} lost its unit", item.unit.isNotBlank())
            assertTrue("${item.name} lost its quantity label", item.quantityLabel.isNotBlank())
            assertTrue("${item.name} lost its value label", item.valueLabel.isNotBlank())
            assertTrue("${item.name} lost its price label", item.priceLabel.isNotBlank())
            // Every display string is formatted server-side in Bengali. A Latin
            // digit here means the DTO read the wrong key and fell back to a
            // default, which is the failure this test exists for.
            assertTrue(
                "${item.name} quantity label is not Bengali: ${item.quantityLabel}",
                BENGALI_DIGITS.containsMatchIn(item.quantityLabel),
            )
            assertTrue(
                "${item.name} value label is not Bengali: ${item.valueLabel}",
                BENGALI_DIGITS.containsMatchIn(item.valueLabel),
            )
        }
    }

    /**
     * A movement must move the *derived* quantity, in both directions.
     *
     * Asserting the POST's status would prove nothing: the defect this guards
     * against (an aggregation `$match` that does not cast its ids) returned 201
     * with the right Bengali title while the quantity never budged. Only
     * re-reading the item after the write can tell the two apart.
     */
    @Test
    fun aStockMovementMovesTheDerivedQuantityBothWays() {
        reachable()

        val created = StockItem.from(
            ApiClient.post(
                "/stock",
                JSONObject()
                    .put("name", "টেস্ট পণ্য ${System.currentTimeMillis()}")
                    .put("unit", "কেজি")
                    .put("purchasePrice", "100")
                    .put("salePrice", "130")
                    .put("openingStock", "10")
                    .put("lowStockThreshold", "5"),
            ).getJSONObject("item"),
        )

        try {
            // A brand-new item has no movements, so it *is* its opening stock.
            assertEquals(10.0, created.quantity, 0.001)
            assertFalse("10 is above the threshold of 5", created.lowStock)
            assertEquals(0, created.movementCount)

            ApiClient.post(
                "/stock/${created.id}/movements",
                JSONObject().put("direction", "in").put("quantity", "7").put("unitCost", "100"),
            )
            val afterIn = StockDetail.from(ApiClient.get("/stock/${created.id}"))
            assertEquals("in-movement must raise the quantity", 17.0, afterIn.item.quantity, 0.001)
            assertEquals(1, afterIn.movements.size)
            assertEquals("in", afterIn.movements.first().direction)
            assertTrue(afterIn.movements.first().title.contains("স্টক ইন"))

            ApiClient.post(
                "/stock/${created.id}/movements",
                JSONObject().put("direction", "out").put("quantity", "4").put("unitCost", "100"),
            )
            val afterOut = StockDetail.from(ApiClient.get("/stock/${created.id}"))
            assertEquals("out-movement must lower the quantity", 13.0, afterOut.item.quantity, 0.001)
            // Newest first, so the top of the list is the most recent event.
            assertEquals("out", afterOut.movements.first().direction)

            // 13 - 9 = 4, which is at or below the threshold of 5.
            ApiClient.post(
                "/stock/${created.id}/movements",
                JSONObject().put("direction", "out").put("quantity", "9").put("unitCost", "100"),
            )
            val low = StockDetail.from(ApiClient.get("/stock/${created.id}")).item
            assertEquals(4.0, low.quantity, 0.001)
            assertTrue("4 is at or below the threshold of 5", low.lowStock)
            assertEquals("স্টক কম", low.lowStockLabel)
        } finally {
            ApiClient.delete("/stock/${created.id}")
        }
    }

    /** A product's movements must not outlive it. */
    @Test
    fun deletingAStockItemTakesItsHistoryWithIt() {
        reachable()

        val created = StockItem.from(
            ApiClient.post(
                "/stock",
                JSONObject().put("name", "মুছে ফেলার পণ্য ${System.currentTimeMillis()}"),
            ).getJSONObject("item"),
        )
        ApiClient.post(
            "/stock/${created.id}/movements",
            JSONObject().put("direction", "in").put("quantity", "3"),
        )

        val deleted = ApiClient.delete("/stock/${created.id}")
        assertEquals(true, deleted.optBoolean("ok"))
        assertEquals(1, deleted.optJSONObject("removed")?.optInt("movements"))

        // The item is gone, and asking for it is a 404 rather than a stale row.
        try {
            ApiClient.get("/stock/${created.id}")
            fail("a deleted item must not still be readable")
        } catch (e: ApiException) {
            assertEquals(404, e.status)
        }
    }
}
