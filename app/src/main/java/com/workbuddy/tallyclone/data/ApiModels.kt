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

data class Bootstrap(
    val user: UserAccount,
    val profile: Profile,
    val summary: Summary,
    val wallet: WalletData,
    val menu: MenuData,
) {
    companion object {
        fun from(o: JSONObject) = Bootstrap(
            user = UserAccount.from(o.optJSONObject("user") ?: JSONObject()),
            profile = Profile.from(o.getJSONObject("profile")),
            summary = Summary.from(o.getJSONObject("summary")),
            wallet = WalletData.from(o.getJSONObject("wallet")),
            menu = MenuData.from(o.getJSONObject("menu")),
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
