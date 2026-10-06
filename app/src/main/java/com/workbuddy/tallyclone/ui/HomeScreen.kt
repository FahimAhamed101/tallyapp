package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CustomerItem
import kotlinx.coroutines.launch

// ---------------------------------------------------------------------------
// Service grid (static - these are app features, not server data)
// ---------------------------------------------------------------------------

private data class Service(
    val paths: List<String>,
    val color: Color,
    val shadow: Color,
    val label: String,
    /**
     * Set only on tiles that are actually wired up. The rest of the grid is
     * decorative, exactly as in the reference app, so tapping them does nothing
     * rather than opening a blank screen.
     */
    val key: String? = null,
)

/** The 2x4 service grid, in the reference app's order. */
private val services = listOf(
    Service(TallyIcons.Book, TallyColors.GlyphGreen, TallyColors.ShadowGreen, "মাল্টি ব্যবসা", key = SERVICE_BUSINESSES),
    Service(TallyIcons.Box, TallyColors.GlyphRed, TallyColors.ShadowRed, "স্টক হিসাব", key = SERVICE_STOCK),
    Service(TallyIcons.Note, TallyColors.GlyphOrange, TallyColors.ShadowOrange, "ব্যবসার নোট", key = SERVICE_NOTES),
    Service(TallyIcons.Bell, TallyColors.GlyphGreen, TallyColors.ShadowGreen, "গ্রুপ তাগাদা"),
    Service(TallyIcons.Qr, TallyColors.GlyphRed, TallyColors.ShadowRed, "QR কোড"),
    Service(TallyIcons.Cloud, TallyColors.GlyphGreen, TallyColors.ShadowGreen, "ডাটা ব্যাকআপ"),
    Service(TallyIcons.Chat, TallyColors.GlyphRed, TallyColors.ShadowRed, "টালি-মেসেজ"),
    Service(TallyIcons.Envelope, TallyColors.GlyphOrange, TallyColors.ShadowOrange, "ক্যাশবক্স"),
)

/** Key for the মাল্টি ব্যবসা tile — opens the book switcher sheet. */
const val SERVICE_BUSINESSES = "businesses"

/** Key for the স্টক হিসাব tile — opens the product list. */
const val SERVICE_STOCK = "stock"

/** Key for the ব্যবসার নোট tile — opens checklist notes. */
const val SERVICE_NOTES = "notes"

/**
 * টালি tab. Vertical rhythm taken from the reference app's uiautomator dump
 * (720x1520 px @ 280 dpi => 1.75 px per dp); the content itself comes from the
 * Express API.
 */
@Composable
fun HomeScreen(
    store: AppStore,
    onTabSelected: (Int) -> Unit,
    onCustomerClick: (CustomerItem) -> Unit,
    onAddCustomer: () -> Unit,
    onEditCustomer: (CustomerItem) -> Unit,
    onOpenBusinesses: () -> Unit,
    onOpenStock: () -> Unit,
    onOpenNotes: () -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    val profile = store.profile
    val summary = store.summary

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        // Gold block: toolbar + service grid card share one gradient background
        // so the card's rounded top corners reveal gold underneath.
        Box(
            Modifier
                .fillMaxWidth()
                .background(GoldBrush),
        ) {
            Column {
                GoldHeader(
                    // The book you are in, not the account holder.
                    businessName = store.toolbarName,
                    inboxBadge = profile?.inboxUnread ?: 0,
                    onBusinessClick = onOpenBusinesses,
                )
                ServicesCard(onServiceClick = { key ->
                    when (key) {
                        SERVICE_BUSINESSES -> onOpenBusinesses()
                        SERVICE_STOCK -> onOpenStock()
                        SERVICE_NOTES -> onOpenNotes()
                    }
                })
            }
        }

        ErrorBanner(store) { scope.launch { store.refreshHome() } }

        BalanceRow(
            receivable = summary?.receivableDisplay ?: "০.০০",
            payable = summary?.payableDisplay ?: "০.০০",
        )
        SearchRow()
        ListHeaderRow(summary?.customerLabel ?: "", isEmpty = store.customers.isEmpty())

        Box(Modifier.weight(1f)) {
            when {
                store.loading && store.customers.isEmpty() -> LoadingBox(Modifier.fillMaxSize())

                store.customers.isEmpty() -> EmptyCustomerIllustration()

                else -> Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                ) {
                    store.customers.forEachIndexed { index, customer ->
                        CustomerRow(
                            customer = customer,
                            onClick = { onCustomerClick(customer) },
                            onLongClick = { onEditCustomer(customer) },
                        )
                        if (index == 0) CalloutCard(customer.name)
                    }
                    Spacer(Modifier.height(76.dp))
                }
            }

            CtaButton(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 12.dp, bottom = 12.dp),
                onClick = onAddCustomer,
            )
        }

        BottomNav(selected = TAB_HOME, onSelect = onTabSelected)
    }
}

// ---------------------------------------------------------------------------
// Service grid
// ---------------------------------------------------------------------------

@Composable
private fun ServicesCard(onServiceClick: (String) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
            .background(TallyColors.CardCream)
            .padding(start = 8.dp, end = 8.dp, top = 18.dp, bottom = 13.dp),
    ) {
        services.chunked(4).forEach { rowItems ->
            Row(Modifier.fillMaxWidth()) {
                rowItems.forEach { service ->
                    ServiceCell(
                        service = service,
                        modifier = Modifier.weight(1f),
                        onClick = service.key?.let { key -> { onServiceClick(key) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun ServiceCell(service: Service, modifier: Modifier, onClick: (() -> Unit)? = null) {
    Column(
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(top = 8.dp, bottom = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SoftIcon(
            paths = service.paths,
            color = service.color,
            shadowColor = service.shadow,
            size = 28.dp,
        )
        Spacer(Modifier.height(4.dp))
        Box(Modifier.height(21.dp), contentAlignment = Alignment.Center) {
            Text(
                text = service.label,
                fontSize = 12.sp,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

@Composable
private fun BalanceRow(receivable: String, payable: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BalanceCard(receivable, "মোট পাবো", TallyColors.ZeroRed, Modifier.weight(1f))
        Box(
            Modifier
                .width(12.dp)
                .height(40.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(TallyColors.DividerGray),
            )
        }
        BalanceCard(payable, "মোট দেবো", TallyColors.ZeroGreen, Modifier.weight(1f))
    }
}

@Composable
private fun BalanceCard(
    amount: String,
    label: String,
    color: Color,
    modifier: Modifier,
) {
    Column(
        modifier.height(72.5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = amount,
            fontSize = if (amount.length > 6) 24.sp else 32.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            maxLines = 1,
        )
        Box(Modifier.height(21.dp), contentAlignment = Alignment.Center) {
            Text(label, fontSize = 13.sp, color = TallyColors.TextBody, maxLines = 1)
        }
    }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

@Composable
private fun SearchRow() {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier
                .weight(1f)
                .height(40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(TallyColors.FieldGray)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LineIcon(TallyIcons.Search, TallyColors.TextPrimary, 20.dp, strokeWidth = 2.0f)
            Spacer(Modifier.width(10.dp))
            Text("খোঁজ", fontSize = 14.sp, color = TallyColors.TextHint, maxLines = 1)
        }
        Spacer(Modifier.width(8.dp))
        CircleIconButton(TallyIcons.Filter)
        Spacer(Modifier.width(8.dp))
        CircleIconButton(TallyIcons.Download)
    }
}

@Composable
private fun CircleIconButton(paths: List<String>) {
    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(TallyColors.FieldGray),
        contentAlignment = Alignment.Center,
    ) {
        LineIcon(paths, TallyColors.TextPrimary, 20.dp, strokeWidth = 1.9f)
    }
}

// ---------------------------------------------------------------------------
// Customer list
// ---------------------------------------------------------------------------

@Composable
private fun ListHeaderRow(customerLabel: String, isEmpty: Boolean = false) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(32.6.dp)
            .padding(start = 12.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val label = if (isEmpty) "কাস্টমার ০ / সাপ্লায়ার ০" else customerLabel
        Text(label, fontSize = 13.sp, color = TallyColors.TextBody, maxLines = 1)
        if (!isEmpty) {
            Spacer(Modifier.weight(1f))
            Text("পাবো", fontSize = 13.sp, color = TallyColors.PaboRed, maxLines = 1)
            Text(" / ", fontSize = 13.sp, color = TallyColors.TextHint, maxLines = 1)
            Text("দেবো", fontSize = 13.sp, color = TallyColors.DeboGreen, maxLines = 1)
        }
    }
    Spacer(Modifier.height(6.5.dp))
}

@Composable
private fun EmptyCustomerIllustration() {
    Column(
        Modifier
            .fillMaxSize()
            .padding(bottom = 60.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier
                .size(136.dp)
                .clip(CircleShape)
                .background(Color(0xFFF3F4F6)),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Box(
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF059669)),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Check, Color.White, 13.dp, strokeWidth = 2.4f)
                }
                Spacer(Modifier.width(10.dp))
                LineIcon(TallyIcons.Person, Color(0xFFD97706), 52.dp, strokeWidth = 1.6f)
                Spacer(Modifier.width(10.dp))
                Box(
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFEA580C)),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Book, Color.White, 13.dp, strokeWidth = 1.8f)
                }
            }
        }
        Spacer(Modifier.height(18.dp))
        Text(
            text = "ব্যবহার শুরু করতে কাস্টমার/সাপ্লায়ার যোগ করুন।",
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF1F2937),
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CustomerRow(
    customer: CustomerItem,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.6.dp)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(start = 12.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(
            photoUrl = customer.photoUrl.takeIf { it.isNotBlank() },
            initials = customer.initials,
            size = 40.dp,
            background = customer.avatarColor,
            textColor = customer.avatarTextColor,
            fontSize = 15.sp,
        )
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(customer.name, fontSize = 15.sp, color = TallyColors.TextPrimary, maxLines = 1)
            Text(
                text = customer.note.ifBlank { customer.subtitle },
                fontSize = 12.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        Text(
            text = customer.amountDisplay,
            fontSize = 15.sp,
            color = toneColor(customer.amountTone),
            maxLines = 1,
        )
        Spacer(Modifier.width(8.dp))
        LineIcon(TallyIcons.ChevronRight, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.8f)
    }
}

/** The orange "start a ledger" coach-mark under the first customer row. */
@Composable
private fun CalloutCard(name: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 12.dp, end = 12.dp, top = 2.dp, bottom = 10.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .border(1.5.dp, TallyColors.CalloutBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(TallyIcons.HandDoc, TallyColors.GlyphOrange, 40.dp, strokeWidth = 1.5f)
        Spacer(Modifier.width(14.dp))
        Column {
            Text(
                text = "হিসাব শুরু করুন",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = "$name-এর সাথে লেনদেন এড়িয়ে করতে টাপ করুন।",
                fontSize = 13.sp,
                color = TallyColors.TextSecondary,
                lineHeight = 19.sp,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

@Composable
private fun CtaButton(modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .height(47.4.dp)
            .clip(RoundedCornerShape(50))
            .background(TallyColors.CtaRed)
            .clickable { onClick() }
            .padding(start = 12.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(TallyIcons.PersonPlus, Color.White, 20.dp, strokeWidth = 1.9f)
        Spacer(Modifier.width(6.dp))
        Text(
            text = "নতুন কাস্টমার/সাপ্লায়ার",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 1,
        )
    }
}
