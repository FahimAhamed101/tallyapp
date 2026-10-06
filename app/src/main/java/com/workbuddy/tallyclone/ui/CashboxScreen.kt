package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import com.workbuddy.tallyclone.data.CashboxRowItem
import kotlinx.coroutines.launch

/**
 * ক্যাশবক্স tab - a cream summary card on top of the cash movements, all
 * derived server-side from the cashbox entries.
 */
@Composable
fun CashboxScreen(
    store: AppStore,
    onTabSelected: (Int) -> Unit,
    onRowClick: (String) -> Unit,
    onOpenReport: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val data = store.cashbox

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(GoldBrush),
        ) {
            Column {
                GoldHeader(
                    businessName = store.toolbarName,
                    inboxBadge = store.profile?.inboxUnread ?: 0,
                )
                CashboxSummary(
                    todaySale = data?.todaySale ?: "০.০০",
                    currentCash = data?.currentCash ?: "০.০০",
                    todayIn = data?.todayIn ?: "০.০০",
                    todayOut = data?.todayOut ?: "০.০০",
                    receivable = data?.receivable ?: "০.০০",
                    payable = data?.payable ?: "০.০০",
                    onOpenReport = onOpenReport,
                )
            }
        }

        ErrorBanner(store) { scope.launch { store.refreshCashbox() } }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            when {
                store.loading && data == null -> LoadingBox()
                data == null -> EmptyBox("ক্যাশবক্স ডাটা পাওয়া যায়নি")
                else -> data.rows.forEach { row ->
                    CashboxRowItemView(row) { onRowClick(row.key) }
                }
            }
        }

        BottomNav(selected = TAB_CASHBOX, onSelect = onTabSelected)
    }
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

@Composable
private fun CashboxSummary(
    todaySale: String,
    currentCash: String,
    todayIn: String,
    todayOut: String,
    receivable: String,
    payable: String,
    onOpenReport: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
            .background(TallyColors.CashboxCream),
    ) {
        // --- today's sale / current cash ---------------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 14.dp, bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BigStat(todaySale, "আজকের বেচা", TallyColors.ZeroRed, Modifier.weight(1f))
            Box(Modifier.width(1.dp).height(52.dp).background(Color(0x33A98E5C)))
            BigStat(currentCash, "বর্তমান কাশ", TallyColors.ZeroGreen, Modifier.weight(1f))
        }

        // --- white inner card: আজ পেলাম / আজ দিলাম + actions --------------
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .padding(vertical = 12.dp),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DotStat("আজ পেলাম", todayIn, TallyColors.RowGreenIcon, Modifier.weight(1f))
                Box(Modifier.width(1.dp).height(20.dp).background(TallyColors.DividerGray))
                DotStat("আজ দিলাম", todayOut, TallyColors.RowRedIcon, Modifier.weight(1f), alignEnd = true)
            }

            Spacer(Modifier.height(12.dp))

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PillButton(
                    label = "রিপোর্ট",
                    background = TallyColors.ReportPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Document,
                    onClick = onOpenReport,
                )
                Spacer(Modifier.weight(1f))
                PillButton(
                    label = "কাশবক্স মিলাই",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Swap,
                    onClick = {},
                )
                Spacer(Modifier.width(10.dp))
                Box(
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(TallyColors.SoftPill),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Eye, TallyColors.TextBody, 20.dp, strokeWidth = 1.7f)
                }
            }
        }

        // --- বাকি আদায় / পেমেন্ট দেয়া ------------------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("বাকি আদায়", fontSize = 13.5.sp, color = TallyColors.TextBody, maxLines = 1)
            Spacer(Modifier.width(4.dp))
            Text(receivable, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TallyColors.TextPrimary)
            Spacer(Modifier.width(3.dp))
            Dot(TallyColors.RowGreenIcon)
            Spacer(Modifier.weight(1f))
            Text("পেমেন্ট দেয়া", fontSize = 13.5.sp, color = TallyColors.TextBody, maxLines = 1)
            Spacer(Modifier.width(4.dp))
            Text(payable, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TallyColors.TextPrimary)
            Spacer(Modifier.width(3.dp))
            Dot(TallyColors.RowRedIcon)
        }
    }
}

@Composable
private fun BigStat(amount: String, label: String, color: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = amount,
            fontSize = if (amount.length > 7) 22.sp else 29.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            maxLines = 1,
        )
        Spacer(Modifier.height(2.dp))
        Text(label, fontSize = 13.5.sp, color = TallyColors.TextBody, maxLines = 1)
    }
}

@Composable
private fun DotStat(
    label: String,
    amount: String,
    dotColor: Color,
    modifier: Modifier,
    alignEnd: Boolean = false,
) {
    Row(
        modifier,
        horizontalArrangement = if (alignEnd) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 13.5.sp, color = TallyColors.TextBody, maxLines = 1)
        Spacer(Modifier.width(4.dp))
        Text(amount, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TallyColors.TextPrimary)
        Spacer(Modifier.width(3.dp))
        Dot(dotColor)
    }
}

@Composable
private fun Dot(color: Color) {
    Box(Modifier.size(7.dp).clip(CircleShape).background(color))
}

// ---------------------------------------------------------------------------
// Movement rows
// ---------------------------------------------------------------------------

@Composable
private fun CashboxRowItemView(row: CashboxRowItem, onClick: () -> Unit) {
    val circle = if (row.income) TallyColors.RowGreenCircle else TallyColors.RowRedCircle
    val glyph = if (row.income) TallyColors.RowGreenIcon else TallyColors.RowRedIcon
    val amountColor = if (row.income) TallyColors.AmountGreen else TallyColors.AmountRed
    val icon = if (row.income) TallyIcons.HandReceive else TallyIcons.HandGive

    Row(
        Modifier
            .fillMaxWidth()
            .height(70.dp)
            .clickable { onClick() }
            .padding(start = 16.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(circle),
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(icon, glyph, 26.dp, strokeWidth = 1.7f)
        }
        Spacer(Modifier.width(14.dp))
        Text(
            text = row.label,
            fontSize = 15.sp,
            color = TallyColors.TextPrimary,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = row.amountDisplay,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.Bold,
            color = amountColor,
            maxLines = 1,
        )
        Spacer(Modifier.width(6.dp))
        LineIcon(TallyIcons.ChevronRight, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.8f)
    }
}
