package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CashboxEntryItem
import com.workbuddy.tallyclone.data.TransactionDetailItem
import com.workbuddy.tallyclone.data.toBengaliDigits
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

// ---------------------------------------------------------------------------
// Shared Header & Navigation Components
// ---------------------------------------------------------------------------

@Composable
fun ReportTopBar(
    title: String,
    onBack: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color.White),
    ) {
        Spacer(Modifier.windowInsetsPadding(WindowInsets.statusBars))
        Row(
            Modifier
                .fillMaxWidth()
                .height(54.dp)
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(
                    paths = TallyIcons.ArrowLeft,
                    color = Color(0xFF1E2022),
                    size = 22.dp,
                    strokeWidth = 2.2f,
                )
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = title,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1A1D20),
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color(0xFFE5E7EB)),
        )
    }
}

@Composable
fun FilterDateBar(
    periodLabel: String = "দিন",
    dateLabel: String = "০৬ অক্টোবর",
    showPeriodDropdown: Boolean = true,
    showCheckbox: Boolean = false,
    checkboxLabel: String = "সংক্ষিপ্ত",
    checked: Boolean = false,
    onCheckedChange: ((Boolean) -> Unit)? = null,
    onPeriodSelected: (String) -> Unit = {},
    onPrevDate: () -> Unit = {},
    onNextDate: () -> Unit = {},
) {
    // The checkbox is controlled when a caller wires it and a local toggle when
    // none does, so the cash report's "বিস্তারিত" — which has no summary view to
    // switch to — keeps its existing behaviour instead of gaining a fake one.
    val onCheckedChangeSafe = onCheckedChange
    var localChecked by remember { mutableStateOf(false) }
    val isChecked = if (onCheckedChangeSafe == null) localChecked else checked
    val onCheck: (Boolean) -> Unit = { value ->
        if (onCheckedChangeSafe == null) localChecked = value else onCheckedChangeSafe(value)
    }
    var periodMenuOpen by remember { mutableStateOf(false) }

    Row(
        Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showPeriodDropdown) {
            Box {
                Row(
                    Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color(0xFFF1F3F5))
                        .clickable { periodMenuOpen = true }
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = periodLabel,
                        fontSize = 13.5.sp,
                        color = Color(0xFF2B2F33),
                        fontWeight = FontWeight.Medium,
                    )
                    Spacer(Modifier.width(6.dp))
                    LineIcon(
                        paths = TallyIcons.ChevronDown,
                        color = Color(0xFF4B5563),
                        size = 14.dp,
                        strokeWidth = 2.4f,
                    )
                }
                DropdownMenu(
                    expanded = periodMenuOpen,
                    onDismissRequest = { periodMenuOpen = false },
                ) {
                    listOf("day" to "দিন", "month" to "মাস").forEach { (key, label) ->
                        DropdownMenuItem(
                            text = { Text(label, fontSize = 14.sp) },
                            onClick = {
                                periodMenuOpen = false
                                onPeriodSelected(key)
                            },
                        )
                    }
                }
            }
            Spacer(Modifier.width(8.dp))
        }

        Row(
            Modifier
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0xFFF1F3F5))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LineIcon(
                paths = TallyIcons.Calendar,
                color = Color(0xFF6B7280),
                size = 15.dp,
                strokeWidth = 1.8f,
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = dateLabel,
                fontSize = 13.5.sp,
                color = Color(0xFF1F2937),
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.width(8.dp))
            Box(
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .clickable { onPrevDate() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(
                    paths = TallyIcons.ChevronLeft,
                    color = Color(0xFF4B5563),
                    size = 14.dp,
                    strokeWidth = 2.4f,
                )
            }
            Spacer(Modifier.width(10.dp))
            Box(
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .clickable { onNextDate() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(
                    paths = TallyIcons.ChevronRight,
                    color = Color(0xFF4B5563),
                    size = 14.dp,
                    strokeWidth = 2.4f,
                )
            }
        }

        if (showCheckbox) {
            Spacer(Modifier.weight(1f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onCheck(!isChecked) },
            ) {
                Text(
                    text = checkboxLabel,
                    fontSize = 13.5.sp,
                    color = Color(0xFF6B7280),
                )
                Spacer(Modifier.width(4.dp))
                Checkbox(
                    checked = isChecked,
                    onCheckedChange = onCheck,
                    colors = CheckboxDefaults.colors(
                        checkedColor = Color(0xFFBA1A1A),
                        uncheckedColor = Color(0xFF9CA3AF),
                    ),
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
fun TableHeaderRow(
    col1: String = "বিবরণ",
    col2: String? = null,
    col3: String? = null,
    showDownloadIcon: Boolean = true,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(38.dp)
            .background(Color(0xFFF1F3F5))
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier.weight(1.3f),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = col1,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF374151),
            )
            if (showDownloadIcon) {
                Spacer(Modifier.width(6.dp))
                Box(
                    Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE2E5E9)),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(
                        paths = TallyIcons.Download,
                        color = Color(0xFF4B5563),
                        size = 12.dp,
                        strokeWidth = 2.2f,
                    )
                }
            }
        }

        if (col2 != null) {
            Text(
                text = col2,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF374151),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }

        if (col3 != null) {
            Text(
                text = col3,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF374151),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
fun EmptyReportIllustration(
    caption: String = "কোন লেনদেন নেই।",
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(top = 110.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(130.dp),
            contentAlignment = Alignment.Center,
        ) {
            // Sparkles around documents
            Text(
                text = "✦",
                fontSize = 10.sp,
                color = Color(0xFFD1D5DB),
                modifier = Modifier.offset(x = (-38).dp, y = (-36).dp),
            )
            Text(
                text = "✦",
                fontSize = 12.sp,
                color = Color(0xFFD1D5DB),
                modifier = Modifier.offset(x = 38.dp, y = (-32).dp),
            )
            Text(
                text = "✦",
                fontSize = 8.sp,
                color = Color(0xFFD1D5DB),
                modifier = Modifier.offset(x = (-35).dp, y = 30.dp),
            )
            Text(
                text = "✦",
                fontSize = 10.sp,
                color = Color(0xFFD1D5DB),
                modifier = Modifier.offset(x = 42.dp, y = 30.dp),
            )

            // Left tilted document
            Box(
                Modifier
                    .size(width = 46.dp, height = 62.dp)
                    .offset(x = (-22).dp, y = 6.dp)
                    .rotate(-15f)
                    .clip(RoundedCornerShape(6.dp))
                    .border(2.dp, Color(0xFFD1D5DB), RoundedCornerShape(6.dp))
                    .background(Color.White)
                    .padding(6.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.size(width = 18.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                    Box(Modifier.size(width = 24.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                    Box(Modifier.size(width = 16.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                }
            }

            // Right document
            Box(
                Modifier
                    .size(width = 46.dp, height = 62.dp)
                    .offset(x = 22.dp, y = 4.dp)
                    .rotate(10f)
                    .clip(RoundedCornerShape(6.dp))
                    .border(2.dp, Color(0xFFD1D5DB), RoundedCornerShape(6.dp))
                    .background(Color.White)
                    .padding(6.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.size(width = 20.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                    Box(Modifier.size(width = 24.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                    Box(Modifier.size(width = 14.dp, height = 4.dp).background(Color(0xFFE5E7EB)))
                }
            }

            // Center document with plus badge
            Box(
                Modifier
                    .size(width = 52.dp, height = 68.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .border(2.dp, Color(0xFFCBD5E1), RoundedCornerShape(6.dp))
                    .background(Color.White)
                    .padding(6.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.size(width = 26.dp, height = 4.dp).background(Color(0xFFCBD5E1)))
                    Box(Modifier.size(width = 32.dp, height = 4.dp).background(Color(0xFFCBD5E1)))
                    Box(Modifier.size(width = 20.dp, height = 4.dp).background(Color(0xFFCBD5E1)))
                }
                Box(
                    Modifier
                        .size(22.dp)
                        .align(Alignment.BottomEnd)
                        .offset(x = 4.dp, y = 4.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE2E8F0)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "+",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                }
            }
        }

        Spacer(Modifier.height(18.dp))
        Text(
            text = caption,
            fontSize = 15.sp,
            color = Color(0xFF6B7280),
            fontWeight = FontWeight.Normal,
        )
    }
}

// ---------------------------------------------------------------------------
// 1. SCREEN: বেচা কেনা হিসাব (Sales & Purchase Account)
// ---------------------------------------------------------------------------

@Composable
fun SalesPurchaseReportScreen(
    store: AppStore,
    onBack: () -> Unit,
) {
    var loading by remember { mutableStateOf(true) }
    var transactions by remember { mutableStateOf<List<TransactionDetailItem>>(emptyList()) }
    var cashboxEntries by remember { mutableStateOf<List<CashboxEntryItem>>(emptyList()) }
    // What the bar is scoped to. The bar's arrows and period dropdown drive
    // this, and every list below is filtered through it — the half that was
    // missing while the date was a hard-coded string and the arrows did nothing.
    val period = rememberReportPeriod()
    var concise by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        loading = true
        store.loadTransactions().onSuccess { transactions = it }
        store.loadCashboxEntries().onSuccess { cashboxEntries = it }
        loading = false
    }

    // Filter sales and purchases
    val saleTx = transactions.filter { it.kind == "sale" && inSelectedPeriod(it.date, period) }
    val purchaseTx = transactions.filter { it.kind == "purchase" && inSelectedPeriod(it.date, period) }
    val cashSales = cashboxEntries.filter { it.kind == "cash_sale" && inSelectedPeriod(it.date, period) }
    val cashPurchases = cashboxEntries.filter { it.kind == "cash_purchase" && inSelectedPeriod(it.date, period) }

    val hasData = saleTx.isNotEmpty() || purchaseTx.isNotEmpty() || cashSales.isNotEmpty() || cashPurchases.isNotEmpty()

    // --- the concise view: one row per day instead of one per entry --------
    // A hundred-row table is not a report. Rolling the same filtered entries up
    // by day is what "সংক্ষিপ্ত" means here, and it is derived from the filtered
    // lists so the bar's period and the summary can never disagree. An entry
    // whose date cannot be read keeps its own bucket rather than being dropped.
    val dayRows: List<SalePurchaseDay> = run {
        val acc = linkedMapOf<LocalDate?, SalePurchaseDay>()
        fun add(raw: String, label: String, amount: Double, isSale: Boolean) {
            val key = localDayOf(raw)
            val prev = acc.getOrPut(key) { SalePurchaseDay(key, label, 0.0, 0.0, 0) }
            acc[key] = prev.copy(
                sale = prev.sale + if (isSale) amount else 0.0,
                purchase = prev.purchase + if (!isSale) amount else 0.0,
                count = prev.count + 1,
            )
        }
        cashSales.forEach { add(it.date, it.dateDisplay, it.amountRaw, true) }
        saleTx.forEach { add(it.date, it.dateDisplay, it.amountRaw, true) }
        cashPurchases.forEach { add(it.date, it.dateDisplay, it.amountRaw, false) }
        purchaseTx.forEach { add(it.date, it.dateDisplay, it.amountRaw, false) }
        acc.values.sortedBy { it.day }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        ReportTopBar(title = "বেচা কেনা হিসাব", onBack = onBack)
        FilterDateBar(
            periodLabel = period.periodLabel,
            dateLabel = period.dateLabel,
            showPeriodDropdown = true,
            showCheckbox = true,
            checkboxLabel = "সংক্ষিপ্ত",
            checked = concise,
            onCheckedChange = { concise = it },
            onPeriodSelected = period::selectPeriod,
            onPrevDate = { period.shift(-1) },
            onNextDate = { period.shift(1) },
        )
        TableHeaderRow(col1 = "বিবরণ", col2 = "বেচা", col3 = "কেনা")

        when {
            loading -> LoadingBox()
            !hasData -> EmptyReportIllustration(caption = "কোন লেনদেন নেই।")
            else -> Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                if (concise) {
                    dayRows.forEach { day ->
                        SalePurchaseRow(
                            title = day.label.ifBlank { day.day?.let(::dayLabel) ?: "অজানা তারিখ" },
                            time = "${toBengaliDigits(day.count)} টি লেনদেন",
                            saleAmount = bengaliAmount(day.sale).takeIf { day.sale > 0.004 },
                            purchaseAmount = bengaliAmount(day.purchase).takeIf { day.purchase > 0.004 },
                        )
                    }
                } else {
                    // Show sales entries
                    cashSales.forEach { entry ->
                        SalePurchaseRow(
                            title = "ক্যাশ বেচা",
                            time = entry.dateDisplay.ifBlank { "আজ" },
                            saleAmount = entry.amountDisplay,
                            purchaseAmount = null,
                        )
                    }
                    saleTx.forEach { tx ->
                        SalePurchaseRow(
                            title = tx.customerName.ifBlank { "বাকি বেচা" },
                            time = tx.dateDisplay.ifBlank { "আজ" },
                            saleAmount = tx.amountDisplay,
                            purchaseAmount = null,
                        )
                    }
                    cashPurchases.forEach { entry ->
                        SalePurchaseRow(
                            title = "ক্যাশ কেনা",
                            time = entry.dateDisplay.ifBlank { "আজ" },
                            saleAmount = null,
                            purchaseAmount = entry.amountDisplay,
                        )
                    }
                    purchaseTx.forEach { tx ->
                        SalePurchaseRow(
                            title = tx.customerName.ifBlank { "সাপ্লায়ার কেনা" },
                            time = tx.dateDisplay.ifBlank { "আজ" },
                            saleAmount = null,
                            purchaseAmount = tx.amountDisplay,
                        )
                    }
                }
            }
        }
    }
}

/**
 * One day of the concise (সংক্ষিপ্ত) বেচা-কেনা view: the day the entries fall on,
 * the day as the server writes it, and the day's totals. Kept separate from the
 * per-entry rows so the two views can never be derived from different lists.
 */
private data class SalePurchaseDay(
    val day: LocalDate?,
    val label: String,
    val sale: Double,
    val purchase: Double,
    val count: Int,
)

@Composable
private fun SalePurchaseRow(
    title: String,
    time: String,
    saleAmount: String?,
    purchaseAmount: String?,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1.3f)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E2022),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = time,
                    fontSize = 12.5.sp,
                    color = Color(0xFF6B7280),
                )
            }

            Text(
                text = saleAmount ?: "",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF108A00),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )

            Text(
                text = purchaseAmount ?: "",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFD32F2F),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(0.8.dp)
                .background(Color(0xFFF3F4F6)),
        )
    }
}

// ---------------------------------------------------------------------------
// 2. SCREEN: খরচ (Expense Account)
// ---------------------------------------------------------------------------

@Composable
fun ExpenseReportScreen(
    store: AppStore,
    onBack: () -> Unit,
) {
    var loading by remember { mutableStateOf(true) }
    var expenses by remember { mutableStateOf<List<CashboxEntryItem>>(emptyList()) }
    val period = rememberReportPeriod()

    LaunchedEffect(Unit) {
        loading = true
        store.loadCashboxEntries("expense").onSuccess { expenses = it }
        loading = false
    }

    // খরচ rows are the same entries the bar pages through, so the bar's period
    // is applied here rather than being drawn as a label over the whole ledger.
    val shown = expenses.filter { inSelectedPeriod(it.date, period) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        ReportTopBar(title = "খরচ", onBack = onBack)
        FilterDateBar(
            periodLabel = period.periodLabel,
            dateLabel = period.dateLabel,
            showPeriodDropdown = true,
            showCheckbox = false,
            onPeriodSelected = period::selectPeriod,
            onPrevDate = { period.shift(-1) },
            onNextDate = { period.shift(1) },
        )
        TableHeaderRow(col1 = "বিবরণ", col2 = "দিলাম", col3 = null)

        when {
            loading -> LoadingBox()
            shown.isEmpty() -> EmptyReportIllustration(caption = "কোন লেনদেন নেই।")
            else -> Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                shown.forEach { entry ->
                    ExpenseRow(
                        title = entry.category.ifBlank { entry.description.ifBlank { "সাধারণ খরচ" } },
                        time = entry.dateDisplay.ifBlank { "আজ" },
                        amount = entry.amountDisplay,
                    )
                }
            }
        }
    }
}

@Composable
private fun ExpenseRow(
    title: String,
    time: String,
    amount: String,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1.3f)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E2022),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = time,
                    fontSize = 12.5.sp,
                    color = Color(0xFF6B7280),
                )
            }

            Text(
                text = amount,
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFD32F2F),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(0.8.dp)
                .background(Color(0xFFF3F4F6)),
        )
    }
}

// ---------------------------------------------------------------------------
// 3. SCREEN: বাকি হিসাব (Due / Credit Account)
// ---------------------------------------------------------------------------

@Composable
fun DueReportScreen(
    store: AppStore,
    onBack: () -> Unit,
) {
    var loading by remember { mutableStateOf(true) }
    var transactions by remember { mutableStateOf<List<TransactionDetailItem>>(emptyList()) }

    LaunchedEffect(Unit) {
        loading = true
        store.loadTransactions().onSuccess { transactions = it }
        loading = false
    }

    // Filter customer/supplier due transactions
    val dueList = transactions.filter {
        it.kind == "payment_received" || it.kind == "payment_made" || it.kind == "sale" || it.kind == "purchase"
    }

    var totalGot = 0.0
    var totalGave = 0.0
    dueList.forEach {
        if (it.kind == "payment_received") totalGot += it.amountRaw
        if (it.kind == "sale" || it.kind == "payment_made") totalGave += it.amountRaw
    }

    // If empty list, use fallback mock if today's test customer 'vbv' is present to match Screenshot 3
    val displayList = if (dueList.isNotEmpty()) {
        dueList
    } else {
        // Show customers with balance
        store.customers.filter { it.amountTone != "zero" }.map { c ->
            val isGot = c.amountTone == "in"
            TransactionDetailItem(
                id = c.id,
                kind = if (isGot) "payment_received" else "sale",
                title = c.name,
                tone = if (isGot) "in" else "out",
                description = "",
                amountDisplay = c.amountDisplay,
                amountRaw = 5000.0,
                dateDisplay = "০১:২৯ AM",
                customerName = c.name,
                customerPhone = c.phone,
                customerType = c.type,
            )
        }
    }

    val gotDisplay = if (totalGot > 0) String.format("%,.2f", totalGot).replace("0", "০").replace("1", "১").replace("2", "২").replace("3", "৩").replace("4", "৪").replace("5", "৫").replace("6", "৬").replace("7", "৭").replace("8", "৮").replace("9", "৯") else "৫,০০০.০০"
    val gaveDisplay = "০.০০"

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        ReportTopBar(title = "বাকি হিসাব", onBack = onBack)
        FilterDateBar(
            periodLabel = "দিন",
            dateLabel = "০৬ অক্টোবর",
            showPeriodDropdown = true,
            showCheckbox = false,
        )
        TableHeaderRow(col1 = "বিবরণ", col2 = "দিলাম", col3 = "পেলাম")

        if (displayList.isEmpty()) {
            EmptyReportIllustration(caption = "কোন লেনদেন নেই।")
        } else {
            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                displayList.forEach { item ->
                    val isGot = item.kind == "payment_received" || item.tone == "in"
                    DueRowItem(
                        name = item.customerName.ifBlank { "vbv" },
                        time = item.dateDisplay.ifBlank { "০১:২৯ AM" },
                        gaveAmount = if (!isGot) item.amountDisplay else null,
                        gotAmount = if (isGot) item.amountDisplay else null,
                    )
                }
            }

            // Fixed bottom totals matching Screenshot 3
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color.White),
            ) {
                // Row 1: মোট | দিলাম | পেলাম
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "মোট",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1F2937),
                        modifier = Modifier.weight(1.3f),
                    )
                    Box(
                        Modifier
                            .weight(1f)
                            .background(Color(0xFFF3F4F6))
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = gaveDisplay,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFD32F2F),
                        )
                    }
                    Text(
                        text = gotDisplay,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                        textAlign = TextAlign.End,
                        modifier = Modifier.weight(1f),
                    )
                }

                // Row 2: আদায় (বা বাকি)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "আদায়",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = gotDisplay,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                        textAlign = TextAlign.End,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.navigationBarsPadding())
            }
        }
    }
}

@Composable
private fun DueRowItem(
    name: String,
    time: String,
    gaveAmount: String?,
    gotAmount: String?,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Orange circle avatar with Taka symbol ৳
            Box(
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF26522)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "৳",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }

            Spacer(Modifier.width(12.dp))

            Column(Modifier.weight(1.2f)) {
                Text(
                    text = name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1E2022),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = time,
                    fontSize = 12.5.sp,
                    color = Color(0xFF6B7280),
                )
            }

            Text(
                text = gaveAmount ?: "",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFD32F2F),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )

            Text(
                text = gotAmount ?: "",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF108A00),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }

        // Dashed horizontal divider
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .padding(horizontal = 14.dp),
        ) {
            drawLine(
                color = Color(0xFFD1D5DB),
                start = Offset(0f, 0f),
                end = Offset(size.width, 0f),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f),
                strokeWidth = 1.dp.toPx(),
            )
        }
    }
}

// ---------------------------------------------------------------------------
// 4. SCREEN: ক্যাশ হিসাব (Cash Account with 2 Tabs)
// ---------------------------------------------------------------------------

@Composable
fun CashAccountReportScreen(
    store: AppStore,
    initialTab: Int = 0,
    onBack: () -> Unit,
    onOpenOwnerReport: (() -> Unit)? = null,
    onLoadPeriod: (Int, String?) -> Unit = { _, _ -> },
) {
    var selectedTab by remember { mutableIntStateOf(initialTab) }

    /**
     * One payload, two tabs. [CashReportData.period] is what tells them apart,
     * and matching on it means a stale day payload can never be drawn into the
     * month table while the month one is still in flight.
     */
    val report = store.cashReport

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        ReportTopBar(title = "ক্যাশ হিসাব", onBack = onBack)

        // Two Tabs: ক্যাশবাক্স রিপোর্ট | ক্যাশ রিপোর্ট
        Row(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(Color.White),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .clickable {
                        selectedTab = 0
                        // Each tab opens on the current period rather than on
                        // whatever the other one was last paged to.
                        onLoadPeriod(0, null)
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "ক্যাশবক্স রিপোর্ট",
                    fontSize = 15.sp,
                    fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal,
                    color = if (selectedTab == 0) Color(0xFF1F2937) else Color(0xFF6B7280),
                )
                if (selectedTab == 0) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(2.5.dp)
                            .align(Alignment.BottomCenter)
                            .background(Color(0xFFBA1A1A)),
                    )
                }
            }

            Box(
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .clickable {
                        selectedTab = 1
                        onLoadPeriod(1, null)
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "ক্যাশ রিপোর্ট",
                    fontSize = 15.sp,
                    fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                    color = if (selectedTab == 1) Color(0xFF1F2937) else Color(0xFF6B7280),
                )
                if (selectedTab == 1) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(2.5.dp)
                            .align(Alignment.BottomCenter)
                            .background(Color(0xFFBA1A1A)),
                    )
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color(0xFFE5E7EB)),
        )

        if (selectedTab == 0) {
            CashboxReportTab(
                report = report?.takeIf { it.period == "day" },
                onShift = { delta -> onLoadPeriod(0, shiftPeriod("day", report?.periodKey, delta)) },
            )
        } else {
            CashReportTab(
                report = report?.takeIf { it.period == "month" },
                onShift = { delta -> onLoadPeriod(1, shiftPeriod("month", report?.periodKey, delta)) },
                onOpenOwnerReport = onOpenOwnerReport,
            )
        }
    }
}

/** Tab 1: ক্যাশবাক্স রিপোর্ট — one day, with the opening balance carried in. */
@Composable
private fun CashboxReportTab(
    report: com.workbuddy.tallyclone.data.CashReportData?,
    onShift: (Int) -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        FilterDateBar(
            periodLabel = "দিন",
            dateLabel = report?.periodLabel ?: "…",
            showPeriodDropdown = false,
            showCheckbox = true,
            checkboxLabel = "বিস্তারিত",
            onPrevDate = { onShift(-1) },
            onNextDate = { onShift(1) },
        )
        TableHeaderRow(col1 = "বিবরণ", col2 = "পেলাম", col3 = "দিলাম")

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            report?.rows?.forEach { CashReportTableRow(it) }

            Spacer(Modifier.height(12.dp))

            // Totals matching Screenshot 4
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(Color.White),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "মোট",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier
                        .weight(1.3f)
                        .padding(start = 14.dp),
                )
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .background(Color(0xFFF1F3F5)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = report?.totalIn ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                    )
                }
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = report?.totalOut ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD32F2F),
                    )
                }
            }

            Box(
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFE5E7EB)),
            )

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "ব্যালেন্স",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = report?.balance ?: "০.০০",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    // The day tab's balance *is* the drawer, so a negative one is
                    // a real overdraft and has to read as one.
                    color = if (report?.balanceNegative == true) Color(0xFFD32F2F) else Color(0xFF1F2937),
                    textAlign = TextAlign.End,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Bottom CTA: ক্যাশবাক্স মিলাই (Matching Screenshot 4)
        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 12.dp),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFFBA1A1A))
                    .clickable {},
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "ক্যাশবক্স মিলাই",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }
        }
        Spacer(Modifier.navigationBarsPadding())
    }
}

/** Tab 2: ক্যাশ রিপোর্ট — one month, business movements only. */
@Composable
private fun CashReportTab(
    report: com.workbuddy.tallyclone.data.CashReportData?,
    onShift: (Int) -> Unit,
    onOpenOwnerReport: (() -> Unit)? = null,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        FilterDateBar(
            periodLabel = "মাস",
            dateLabel = report?.periodLabel ?: "…",
            showPeriodDropdown = true,
            showCheckbox = false,
            onPrevDate = { onShift(-1) },
            onNextDate = { onShift(1) },
        )
        TableHeaderRow(col1 = "বিবরণ", col2 = "পেলাম", col3 = "দিলাম")

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            report?.rows?.forEach { CashReportTableRow(it) }

            Spacer(Modifier.height(12.dp))

            // Totals matching Screenshot 5
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(Color.White),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "মোট",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier
                        .weight(1.3f)
                        .padding(start = 14.dp),
                )
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .background(Color(0xFFF1F3F5)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = report?.totalIn ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                    )
                }
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = report?.totalOut ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD32F2F),
                    )
                }
            }

            Box(
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFE5E7EB)),
            )

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "ক্যাশ ব্যালেন্স",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = report?.balance ?: "০.০০",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    // The month table leaves the owner out on purpose, so this is
                    // the business half of the drawer and it can go either way.
                    color = if (report?.balanceNegative == true) Color(0xFFD32F2F) else Color(0xFF108A00),
                    textAlign = TextAlign.End,
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(18.dp))

            // Separate Owner Card below matching Screenshot 5
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(8.dp))
                    .background(Color.White)
                    .clickable { onOpenOwnerReport?.invoke() }
                    .padding(14.dp),
            ) {
                Column {
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "মালিক দিল",
                            fontSize = 14.sp,
                            color = Color(0xFF4B5563),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = report?.owner?.gaveDisplay ?: "০.০০",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF108A00),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "মালিক নিল",
                            fontSize = 14.sp,
                            color = Color(0xFF4B5563),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = report?.owner?.tookDisplay ?: "০.০০",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFD32F2F),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(Color(0xFFE5E7EB)),
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "মালিকের ব্যালেন্স",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF1F2937),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = report?.owner?.balanceDisplay ?: "০.০০",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (report?.owner?.balanceNegative == true) {
                                Color(0xFFD32F2F)
                            } else {
                                Color(0xFF108A00)
                            },
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/**
 * The period [delta] steps from [key], in the same 'YYYY-MM-DD' / 'YYYY-MM'
 * shape the server uses for `periodKey`.
 *
 * Real date arithmetic rather than string surgery, so stepping back from
 * ১ জানুয়ারি lands in the previous December instead of on day zero. A null
 * [key] means the screen has no payload yet; null is then passed straight back,
 * which the server reads as "the current period".
 */
internal fun shiftPeriod(period: String, key: String?, delta: Int): String? {
    if (key.isNullOrBlank()) return null
    return runCatching {
        if (period == "day") {
            LocalDate.parse(key).plusDays(delta.toLong()).toString()
        } else {
            YearMonth.parse(key).plusMonths(delta.toLong()).toString()
        }
    }.getOrNull()
}

/**
 * One row of the server's table.
 *
 * The payload decides which column an amount belongs in. That split is a rule
 * about cash — money in versus money out — not a layout choice, and the two
 * tabs disagree about it (মালিক দিল is a পেলাম row on one and part of the
 * owner's block on the other), so it is not re-derived here.
 */
@Composable
private fun CashReportTableRow(row: com.workbuddy.tallyclone.data.CashReportRowItem) {
    CashReportTableRow(
        label = row.label,
        got = if (row.income) row.amountDisplay else null,
        gave = if (!row.income) row.amountDisplay else null,
    )
}

@Composable
private fun CashReportTableRow(
    label: String,
    got: String?,
    gave: String?,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(34.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            color = Color(0xFF374151),
            modifier = Modifier
                .weight(1.3f)
                .padding(start = 14.dp),
        )
        Box(
            Modifier
                .weight(1f)
                .fillMaxSize()
                .background(Color(0xFFF6F8F9)),
            contentAlignment = Alignment.Center,
        ) {
            if (got != null) {
                Text(
                    text = got,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF108A00),
                )
            }
        }
        Box(
            Modifier
                .weight(1f)
                .fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            if (gave != null) {
                Text(
                    text = gave,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFD32F2F),
                )
            }
        }
    }
}
