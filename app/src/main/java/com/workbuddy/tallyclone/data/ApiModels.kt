package com.workbuddy.tallyclone.data

import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/**
 * JSON models mirroring the Express API. Every display string is formatted
 * server-side in Bengali, so the UI just renders what it is given.
 */

/** "#FFE0B2" -> Color. Falls back to a neutral tint on bad input. */
fun parseHexColor(hex: String?, fallback: Color = Color(0xFFD1FAD1)): Color {
    if (hex.isNullOrBlank()) return fallback
    return try {
        val clean = hex.removePrefix("#")
        val value = clean.toLong(16)
        when (clean.length) {
            6 -> Color(0xFF000000L or value)
            8 -> Color(value)
            else -> fallback
        }
    } catch (_: Exception) {
        fallback
    }
}

data class Profile(
    val name: String,
    val phone: String,
    val initials: String,
    val photoUrl: String,
    val goldPlanName: String,
    val goldTrialLabel: String,
    val inboxUnread: Int,
    val smsLabel: String,
    val appVersion: String,
) {
    companion object {
        fun from(o: JSONObject) = Profile(
            name = o.optString("name", ""),
            phone = o.optString("phone", ""),
            initials = o.optString("initials", "?"),
            photoUrl = o.optString("photoUrl", ""),
            goldPlanName = o.optString("goldPlanName", ""),
            goldTrialLabel = o.optString("goldTrialLabel", ""),
            inboxUnread = o.optInt("inboxUnread", 0),
            smsLabel = o.optString("smsLabel", ""),
            appVersion = o.optString("appVersion", ""),
        )
    }
}

data class Summary(
    val receivableDisplay: String,
    val payableDisplay: String,
    val customerLabel: String,
) {
    companion object {
        fun from(o: JSONObject) = Summary(
            receivableDisplay = o.optJSONObject("receivable")?.optString("display") ?: "০.০০",
            payableDisplay = o.optJSONObject("payable")?.optString("display") ?: "০.০০",
            customerLabel = o.optString("customerLabel", ""),
        )
    }
}

/** The logged-in account, as returned by /auth/login, /auth/register and /auth/me. */
data class UserAccount(
    val id: String,
    val name: String,
    val phone: String,
    val photoUrl: String,
) {
    companion object {
        fun from(o: JSONObject) = UserAccount(
            id = o.optString("id"),
            name = o.optString("name"),
            phone = o.optString("phone"),
            photoUrl = o.optString("photoUrl", ""),
        )
    }
}

/** { token, user } — the shape of a successful login or registration. */
data class AuthResult(val token: String, val user: UserAccount) {
    companion object {
        fun from(o: JSONObject) = AuthResult(
            token = o.optString("token"),
            user = UserAccount.from(o.optJSONObject("user") ?: JSONObject()),
        )
    }
}

/** Result of POST /api/uploads. */
data class UploadedImage(val url: String, val publicId: String) {
    companion object {
        fun from(o: JSONObject) = UploadedImage(
            url = o.optString("url"),
            publicId = o.optString("publicId"),
        )
    }
}

data class CustomerItem(
    val id: String,
    val name: String,
    val phone: String,
    val type: String,
    /** Free-text বিবরণ typed on the add/edit form. */
    val note: String,
    val initials: String,
    val avatarColor: Color,
    val avatarTextColor: Color,
    val subtitle: String,
    val amountDisplay: String,
    val amountTone: String,
    /** Cloudinary URL when the user attached a photo, otherwise "". */
    val photoUrl: String,
) {
    val isSupplier: Boolean get() = type == "supplier"

    companion object {
        fun from(o: JSONObject) = CustomerItem(
            id = o.optString("id"),
            name = o.optString("name"),
            phone = o.optString("phone", ""),
            type = o.optString("type", "customer"),
            note = o.optString("note", ""),
            initials = o.optString("initials", "?"),
            avatarColor = parseHexColor(o.optString("avatarColor")),
            avatarTextColor = parseHexColor(o.optString("avatarTextColor"), Color(0xFF1A1A1A)),
            subtitle = o.optString("subtitle", ""),
            amountDisplay = o.optString("amountDisplay", "০.০০"),
            amountTone = o.optString("amountTone", "zero"),
            photoUrl = o.optString("photoUrl", ""),
        )
    }
}

data class CashboxRowItem(
    val key: String,
    val label: String,
    val income: Boolean,
    val amountDisplay: String,
) {
    companion object {
        fun from(o: JSONObject) = CashboxRowItem(
            key = o.optString("key"),
            label = o.optString("label"),
            income = o.optBoolean("income", false),
            amountDisplay = o.optString("amountDisplay", "০.০০"),
        )
    }
}

data class CashboxDashboard(
    val todaySale: String,
    val currentCash: String,
    val todayIn: String,
    val todayOut: String,
    val receivable: String,
    val payable: String,
    val rows: List<CashboxRowItem>,
) {
    companion object {
        private fun money(o: JSONObject?, key: String) =
            o?.optJSONObject(key)?.optString("display") ?: "০.০০"

        fun from(o: JSONObject) = CashboxDashboard(
            todaySale = money(o, "todaySale"),
            currentCash = money(o, "currentCash"),
            todayIn = money(o, "todayIn"),
            todayOut = money(o, "todayOut"),
            receivable = money(o, "receivable"),
            payable = money(o, "payable"),
            rows = o.optJSONArray("rows").mapObjects { CashboxRowItem.from(it) },
        )
    }
}

data class WalletServiceItem(
    val key: String,
    val label: String,
    val icon: String,
    val enabled: Boolean,
) {
    companion object {
        fun from(o: JSONObject) = WalletServiceItem(
            key = o.optString("key"),
            label = o.optString("label"),
            icon = o.optString("icon", o.optString("key")),
            enabled = o.optBoolean("enabled", false),
        )
    }
}

data class WalletData(
    val balanceDisplay: String,
    val accountOpened: Boolean,
    val services: List<WalletServiceItem>,
    val benefits: List<String>,
) {
    companion object {
        fun from(o: JSONObject) = WalletData(
            balanceDisplay = o.optJSONObject("balance")?.optString("display") ?: "০.০০",
            accountOpened = o.optBoolean("accountOpened", false),
            services = o.optJSONArray("services").mapObjects { WalletServiceItem.from(it) },
            benefits = o.optJSONArray("benefits").mapStrings(),
        )
    }
}

data class MenuEntryItem(
    val key: String,
    val label: String,
    val icon: String,
    val count: Int,
) {
    companion object {
        fun from(o: JSONObject) = MenuEntryItem(
            key = o.optString("key"),
            label = o.optString("label"),
            icon = o.optString("icon"),
            count = o.optInt("count", 0),
        )
    }
}

data class MenuSectionData(val title: String, val items: List<MenuEntryItem>) {
    companion object {
        fun from(o: JSONObject) = MenuSectionData(
            title = o.optString("title"),
            items = o.optJSONArray("items").mapObjects { MenuEntryItem.from(it) },
        )
    }
}

data class MenuData(val sections: List<MenuSectionData>, val version: String) {
    companion object {
        fun from(o: JSONObject) = MenuData(
            sections = o.optJSONArray("sections").mapObjects { MenuSectionData.from(it) },
            version = o.optString("version", ""),
        )
    }
}

data class LedgerHeadline(val label: String, val tone: String, val amountDisplay: String) {
    companion object {
        fun from(o: JSONObject?) = LedgerHeadline(
            label = o?.optString("label") ?: "পাবো",
            tone = o?.optString("tone") ?: "zero",
            amountDisplay = o?.optString("amountDisplay") ?: "০.০০",
        )
    }
}

data class LedgerEntryItem(
    val id: String,
    val title: String,
    val tone: String,
    val amountDisplay: String,
    val dateDisplay: String,
    val description: String,
) {
    companion object {
        fun from(o: JSONObject) = LedgerEntryItem(
            id = o.optString("id"),
            title = o.optString("title"),
            tone = o.optString("tone", "out"),
            amountDisplay = o.optString("amountDisplay", "০.০০"),
            dateDisplay = o.optString("dateDisplay", ""),
            description = o.optString("description", ""),
        )
    }
}

data class LedgerData(
    val customer: CustomerItem,
    val headline: LedgerHeadline,
    val entries: List<LedgerEntryItem>,
) {
    companion object {
        fun from(o: JSONObject) = LedgerData(
            customer = CustomerItem.from(o.getJSONObject("customer")),
            headline = LedgerHeadline.from(o.optJSONObject("headline")),
            entries = o.optJSONArray("entries").mapObjects { LedgerEntryItem.from(it) },
        )
    }
}

/**
 * One book (ব্যবসা) on the account, as the মাল্টি ব্যবসা sheet renders it.
 *
 * Every field is read with `opt*` and a sane default: the sheet is the first
 * thing the home tab opens, and a missing key must degrade a row rather than
 * crash the app.
 */
data class BusinessItem(
    val id: String,
    val name: String,
    val isPrimary: Boolean,
    val customerCount: Int,
    val supplierCount: Int,
    val customerLabel: String,
    val receivableLabel: String,
) {
    /**
     * The grey line under the name, e.g.
     * "কাস্টমার ১, সাপ্লায়ার ০ | মোট পাওয়া ০.০০".
     */
    val subtitle: String get() = "$customerLabel | $receivableLabel"

    companion object {
        fun from(o: JSONObject): BusinessItem = BusinessItem(
            id = o.optString("id"),
            name = o.optString("name"),
            isPrimary = o.optBoolean("isPrimary", false),
            customerCount = o.optInt("customerCount", 0),
            supplierCount = o.optInt("supplierCount", 0),
            customerLabel = o.optString("customerLabel", "কাস্টমার ০, সাপ্লায়ার ০"),
            receivableLabel = o.optString("receivableLabel", "মোট পাওয়া ০.০০"),
        )

        /**
         * Reads the `{ items: [...] }` envelope of GET /api/businesses.
         *
         * Note that `/api/bootstrap` returns the same rows as a *bare* array
         * under `businesses`, not wrapped — so it is parsed separately there.
         * Reading one shape for both silently yields an empty sheet.
         */
        fun listFrom(o: JSONObject): List<BusinessItem> =
            o.optJSONArray("items").mapObjects { from(it) }
    }
}

data class Bootstrap(
    val user: UserAccount,
    val profile: Profile,
    val summary: Summary,
    val wallet: WalletData,
    val menu: MenuData,
    val businesses: List<BusinessItem>,
    val activeBusinessId: String,
    val activeBusinessName: String,
    val maxBusinesses: Int,
) {
    companion object {
        fun from(o: JSONObject) = Bootstrap(
            user = UserAccount.from(o.optJSONObject("user") ?: JSONObject()),
            profile = Profile.from(o.getJSONObject("profile")),
            summary = Summary.from(o.getJSONObject("summary")),
            wallet = WalletData.from(o.getJSONObject("wallet")),
            menu = MenuData.from(o.getJSONObject("menu")),
            businesses = o.optJSONArray("businesses").mapObjects { BusinessItem.from(it) },
            activeBusinessId = o.optString("activeBusinessId"),
            activeBusinessName = o.optString("activeBusinessName"),
            maxBusinesses = o.optInt("maxBusinesses", 5),
        )
    }
}

data class TransactionDetailItem(
    val id: String,
    val kind: String,
    val title: String,
    val tone: String,
    val description: String,
    val amountDisplay: String,
    val amountRaw: Double,
    val dateDisplay: String,
    val customerName: String,
    val customerPhone: String,
    val customerType: String,
) {
    companion object {
        fun from(o: JSONObject) = TransactionDetailItem(
            id = o.optString("id"),
            kind = o.optString("kind"),
            title = o.optString("title"),
            tone = o.optString("tone", "out"),
            description = o.optString("description", ""),
            amountDisplay = o.optString("amountDisplay", "০.০০"),
            amountRaw = o.optDouble("amountRaw", 0.0),
            dateDisplay = o.optString("dateDisplay", ""),
            customerName = o.optString("customerName", ""),
            customerPhone = o.optString("customerPhone", ""),
            customerType = o.optString("customerType", "customer"),
        )
    }
}

data class CashboxEntryItem(
    val id: String,
    val kind: String,
    val title: String,
    val amountDisplay: String,
    val amountRaw: Double,
    val description: String,
    val category: String,
    val dateDisplay: String,
) {
    companion object {
        fun from(o: JSONObject) = CashboxEntryItem(
            id = o.optString("id"),
            kind = o.optString("kind"),
            title = o.optString("title"),
            amountDisplay = o.optString("amountDisplay", "০.০০"),
            amountRaw = o.optDouble("amountRaw", 0.0),
            description = o.optString("description", ""),
            category = o.optString("category", ""),
            dateDisplay = o.optString("dateDisplay", ""),
        )
    }
}

data class ReportSummaryData(
    val sales: String,
    val purchases: String,
    val paymentsReceived: String,
    val paymentsMade: String,
    val cashSales: String,
    val cashPurchases: String,
    val expenses: String,
    val ownerIn: String,
    val ownerOut: String,
    val generatedLabel: String,
    val monthLabel: String,
) {
    companion object {
        private fun money(o: JSONObject, k: String) =
            o.optJSONObject(k)?.optString("display") ?: "০.০০"

        fun from(o: JSONObject) = ReportSummaryData(
            sales = money(o, "sales"),
            purchases = money(o, "purchases"),
            paymentsReceived = money(o, "paymentsReceived"),
            paymentsMade = money(o, "paymentsMade"),
            cashSales = money(o, "cashSales"),
            cashPurchases = money(o, "cashPurchases"),
            expenses = money(o, "expenses"),
            ownerIn = money(o, "ownerIn"),
            ownerOut = money(o, "ownerOut"),
            generatedLabel = o.optString("generatedLabel", ""),
            monthLabel = o.optString("monthLabel", ""),
        )
    }
}

/**
 * One product (পণ্য) in স্টক হিসাব.
 *
 * `quantity` and every label are computed **server-side** from the movement log
 * (`openingStock + in − out`). The app deliberately does not add stock up
 * itself: a client-side running total is a second source of truth, and the two
 * disagree the first time a movement is recorded from another device.
 *
 * Prices stay `Double` as well as having a formatted label, because the edit
 * form has to put a number back into its fields.
 */
data class StockItem(
    val id: String,
    val name: String,
    val unit: String,
    val purchasePrice: Double,
    val salePrice: Double,
    val openingStock: Double,
    val lowStockThreshold: Double,
    val note: String,
    val photoUrl: String,
    /** Derived live quantity. */
    val quantity: Double,
    /** quantity × purchasePrice. */
    val costValue: Double,
    /** quantity × salePrice. */
    val saleValue: Double,
    val lowStock: Boolean,
    val movementCount: Int,
    /** "স্টক: ১২ পিস" */
    val quantityLabel: String,
    /** "মূল্য ৳১,২০০.০০" */
    val valueLabel: String,
    /** "ক্রয় ৳১০০.০০ · বিক্রয় ৳১২০.০০" */
    val priceLabel: String,
    /** "স্টক কম", or "" when the item is fine. */
    val lowStockLabel: String,
    /** "সর্বশেষ ০৪ অক্টোবর, ২৬", or "" before the first movement. */
    val lastMovementLabel: String,
) {
    companion object {
        fun from(o: JSONObject) = StockItem(
            id = o.optString("id"),
            name = o.optString("name"),
            unit = o.optString("unit", "পিস"),
            purchasePrice = o.optDouble("purchasePrice", 0.0),
            salePrice = o.optDouble("salePrice", 0.0),
            openingStock = o.optDouble("openingStock", 0.0),
            lowStockThreshold = o.optDouble("lowStockThreshold", 0.0),
            note = o.optString("note", ""),
            photoUrl = o.optString("photoUrl", ""),
            quantity = o.optDouble("quantity", 0.0),
            costValue = o.optDouble("costValue", 0.0),
            saleValue = o.optDouble("saleValue", 0.0),
            lowStock = o.optBoolean("lowStock", false),
            movementCount = o.optInt("movementCount", 0),
            quantityLabel = o.optString("quantityLabel", ""),
            valueLabel = o.optString("valueLabel", ""),
            priceLabel = o.optString("priceLabel", ""),
            lowStockLabel = o.optString("lowStockLabel", ""),
            lastMovementLabel = o.optString("lastMovementLabel", ""),
        )
    }
}

/** One স্টক ইন / স্টক আউট entry. Append-only, so there is no edit path. */
data class StockMovementItem(
    val id: String,
    /** "in" | "out" */
    val direction: String,
    val quantity: Double,
    val unitCost: Double,
    val note: String,
    /** "স্টক ইন ১২ পিস" */
    val title: String,
    /** "০৪ অক্টোবর, ২৬ · নতুন মাল" */
    val subtitle: String,
    /** "+১২ পিস" / "−১২ পিস" */
    val quantityLabel: String,
    val amountLabel: String,
    val tone: String,
) {
    companion object {
        fun from(o: JSONObject) = StockMovementItem(
            id = o.optString("id"),
            direction = o.optString("direction", "in"),
            quantity = o.optDouble("quantity", 0.0),
            unitCost = o.optDouble("unitCost", 0.0),
            note = o.optString("note", ""),
            title = o.optString("title", ""),
            subtitle = o.optString("subtitle", ""),
            quantityLabel = o.optString("quantityLabel", ""),
            amountLabel = o.optString("amountLabel", "০.০০"),
            tone = o.optString("tone", "in"),
        )
    }
}

/** The header card's totals, summed from the same rows the list renders. */
data class StockSummary(
    val itemCount: Int,
    val totalQuantity: Double,
    val costValue: Double,
    val saleValue: Double,
    val lowStockCount: Int,
    /** "পণ্য ৬টি" */
    val countLabel: String,
    /** "স্টকের মূল্য ৳২৪,৩৬৪.০০" */
    val costValueLabel: String,
    val saleValueLabel: String,
    /** "স্টক কম ১টি", or "" when nothing is low. */
    val lowStockLabel: String,
) {
    companion object {
        fun from(o: JSONObject) = StockSummary(
            itemCount = o.optInt("itemCount", 0),
            totalQuantity = o.optDouble("totalQuantity", 0.0),
            costValue = o.optDouble("costValue", 0.0),
            saleValue = o.optDouble("saleValue", 0.0),
            lowStockCount = o.optInt("lowStockCount", 0),
            countLabel = o.optString("countLabel", ""),
            costValueLabel = o.optString("costValueLabel", ""),
            saleValueLabel = o.optString("saleValueLabel", ""),
            lowStockLabel = o.optString("lowStockLabel", ""),
        )
    }
}

/** `{ items, summary }` — the envelope of GET /api/stock. */
data class StockList(val items: List<StockItem>, val summary: StockSummary) {
    companion object {
        fun from(o: JSONObject) = StockList(
            items = o.optJSONArray("items").mapObjects { StockItem.from(it) },
            summary = StockSummary.from(o.optJSONObject("summary") ?: JSONObject()),
        )
    }
}

/** `{ item, movements }` — the envelope of GET /api/stock/:id. */
data class StockDetail(val item: StockItem, val movements: List<StockMovementItem>) {
    companion object {
        fun from(o: JSONObject) = StockDetail(
            item = StockItem.from(o.getJSONObject("item")),
            movements = o.optJSONArray("movements").mapObjects { StockMovementItem.from(it) },
        )
    }
}

/**
 * সেটিংস — the drawer's সেটিংস row, as the server sees it.
 *
 * Every string the screen renders that *depends on state* arrives in this
 * envelope: the decimal example line (which flips with the toggle), the PIN
 * row's wording, the account's own number. Only the static section headings —
 * সাধারণ সেটিংস / প্রোফাইল সেটিংস / অ্যাপ সিকিউরিটি — are hardcoded in the
 * composable, so a rule change on the server (a different PIN length, say)
 * cannot leave the screen describing the old one.
 *
 * There is deliberately no `pin` field here: the server reports only *whether*
 * one exists. The digits never leave the device except on the way in.
 */
data class AppSettings(
    /** টাকার অঙ্কে দশমিক. */
    val decimalAmount: Boolean,
    /** নোটিফিকেশন সাউন্ড. */
    val notificationSound: Boolean,
    /** Whether an অ্যাপ সিকিউরিটি PIN has been set. */
    val pinSet: Boolean,
    /** "উদাহরণঃ ১২,০০০.০০" */
    val decimalExample: String,
    /** "ভয়েসের মাধ্যমে পেমেন্ট এলার্ট" */
    val voiceNotification: Boolean = true,
    /** "টালিখাতা নোটিফিকেশনে সাউন্ড এলার্ট" */
    val notificationSubtitle: String,
    /** "মোবাইল নম্বর পরিবর্তন" */
    val phoneLabel: String,
    /** "বর্তমান নম্বর +৮৮০১৭০৬৬১৭৭২৩" */
    val phoneSubtitle: String,
    /** "PIN সেট করুন" / "PIN পরিবর্তন করুন" */
    val pinLabel: String,
    /** "PIN সেট করা আছে" / "PIN সেট করা হয়নি" */
    val pinSubtitle: String,
    /** The server's own PIN rule, so the hint cannot drift from the validator. */
    val pinMin: Int,
    val pinMax: Int,
) {
    companion object {
        fun from(o: JSONObject) = AppSettings(
            decimalAmount = o.optBoolean("decimalAmount", true),
            notificationSound = o.optBoolean("notificationSound", true),
            voiceNotification = o.optBoolean("voiceNotification", true),
            pinSet = o.optBoolean("pinSet", false),
            decimalExample = o.optString("decimalExample", "উদাহরণঃ ১২,০০০.০০"),
            notificationSubtitle = o.optString(
                "notificationSubtitle",
                "টালিখাতা নোটিফিকেশনে সাউন্ড এলার্ট",
            ),
            phoneLabel = o.optString("phoneLabel", "মোবাইল নম্বর পরিবর্তন"),
            phoneSubtitle = o.optString("phoneSubtitle", ""),
            pinLabel = o.optString("pinLabel", "PIN সেট করুন"),
            pinSubtitle = o.optString("pinSubtitle", ""),
            pinMin = o.optInt("pinMin", 4),
            pinMax = o.optInt("pinMax", 6),
        )
    }
}

// ---- ব্যবসার নোট ------------------------------------------------------------

data class NoteItem(
    val id: String,
    val text: String,
    val done: Boolean,
    val createdAt: String,
) {
    companion object {
        fun from(o: JSONObject) = NoteItem(
            id = o.optString("id", o.optString("_id")),
            text = o.optString("text"),
            done = o.optBoolean("done", false),
            createdAt = o.optString("createdAt"),
        )
    }
}

// ---- small json helpers ---------------------------------------------------

private inline fun <T> JSONArray?.mapObjects(crossinline f: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    val out = ArrayList<T>(length())
    for (i in 0 until length()) {
        val o = optJSONObject(i) ?: continue
        out.add(f(o))
    }
    return out
}

private fun JSONArray?.mapStrings(): List<String> {
    if (this == null) return emptyList()
    val out = ArrayList<String>(length())
    for (i in 0 until length()) out.add(optString(i))
    return out
}
