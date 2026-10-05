package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CustomerItem
import com.workbuddy.tallyclone.data.LedgerData
import com.workbuddy.tallyclone.data.LedgerEntryItem
import kotlinx.coroutines.launch

/**
 * Customer ledger screen - reached by tapping a customer on the home tab.
 * Loads the customer + its ledger from the API; the two amount fields post a
 * new entry and the header balance updates from the response.
 */
@Composable
fun LedgerEntryScreen(
    store: AppStore,
    customerId: String,
    onBack: () -> Unit,
    onEdit: (CustomerItem) -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    var ledger by remember { mutableStateOf<LedgerData?>(null) }
    var loading by remember { mutableStateOf(true) }
    var submitting by remember { mutableStateOf(false) }
    var gave by remember { mutableStateOf("") }
    var got by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    LaunchedEffect(customerId) {
        loading = true
        ledger = store.loadLedger(customerId).getOrNull()
        loading = false
    }

    val canSubmit = (gave.isNotBlank() || got.isNotBlank()) && !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        scope.launch {
            // The reference form has two boxes; post them one after the other.
            var ok = true
            if (gave.isNotBlank()) {
                ok = store.addTransaction(customerId, "gave", gave.trim(), description.trim()).isSuccess && ok
            }
            if (got.isNotBlank()) {
                ok = store.addTransaction(customerId, "got", got.trim(), description.trim()).isSuccess && ok
            }
            ledger = store.loadLedger(customerId).getOrNull()
            submitting = false
            if (ok) {
                gave = ""
                got = ""
                description = ""
                onBack()
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))

        val customer = ledger?.customer

        // --- toolbar ------------------------------------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .height(58.dp)
                .padding(start = 8.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(40.dp).clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(TallyIcons.ChevronLeft, TallyColors.TextPrimary, 24.dp, strokeWidth = 2.2f)
            }
            Spacer(Modifier.width(4.dp))
            Avatar(
                photoUrl = customer?.photoUrl?.takeIf { it.isNotBlank() },
                initials = customer?.initials ?: "…",
                size = 38.dp,
                background = customer?.avatarColor ?: TallyColors.CreditAvatarOrange,
                textColor = customer?.avatarTextColor ?: Color.White,
                fontSize = 14.sp,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = customer?.name ?: "",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            Box(
                Modifier
                    .size(40.dp)
                    .clickable(enabled = customer != null) { customer?.let(onEdit) },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(TallyIcons.Pencil, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.9f)
            }
        }
        Hairline()

        ErrorBanner(store) { scope.launch { ledger = store.loadLedger(customerId).getOrNull() } }

        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(12.dp))

            // --- পাবো / দেবো header + report ------------------------------
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val headline = ledger?.headline
                    val tone = headline?.tone ?: "zero"
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = headline?.label ?: "পাবো",
                            fontSize = 14.sp,
                            color = toneColor(tone),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text("৳", fontSize = 14.sp, color = toneColor(tone))
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = headline?.amountDisplay ?: "০.০০",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = toneColor(tone),
                        )
                    }
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = customer?.subtitle ?: "",
                        fontSize = 12.sp,
                        color = TallyColors.TextHint,
                    )
                }
                PillButton(
                    label = "রিপোর্ট",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Document,
                    onClick = {},
                )
            }

            Spacer(Modifier.height(16.dp))

            // --- দিলাম/বেচা + পেলাম ------------------------------------
            Row(Modifier.fillMaxWidth()) {
                TallyField(
                    value = gave,
                    onValueChange = { gave = it },
                    placeholder = "দিলাম/বেচা",
                    prefix = "৳",
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(12.dp))
                TallyField(
                    value = got,
                    onValueChange = { got = it },
                    placeholder = "পেলাম",
                    prefix = "৳",
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(12.dp))

            TallyField(
                value = description,
                onValueChange = { description = it },
                placeholder = "বিবরণ",
                icon = TallyIcons.NoteEdit,
            )

            Spacer(Modifier.height(14.dp))

            // --- date / photo ------------------------------------------
            Row(verticalAlignment = Alignment.CenterVertically) {
                PillButton(
                    label = "০৪ অক্টোবর",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Calendar,
                    bold = false,
                    onClick = {},
                )
                Spacer(Modifier.weight(1f))
                PillButton(
                    label = "ছবি",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Camera,
                    bold = false,
                    onClick = {},
                )
            }

            Spacer(Modifier.height(18.dp))

            InfoBox(smsLabel = store.profile?.smsLabel ?: "টালি-মেসেজ অবশিষ্ট: ০")

            Spacer(Modifier.height(18.dp))

            // --- ledger entries ----------------------------------------
            Text(
                text = "লেনদেনের তালিকা",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
            )
            Spacer(Modifier.height(6.dp))

            when {
                loading -> LoadingBox()
                ledger == null -> EmptyBox("লেনদেন লোড করা যায়নি")
                ledger!!.entries.isEmpty() -> EmptyBox("এখনো কোনো লেনদেন নেই")
                else -> ledger!!.entries.forEach { LedgerRow(it) }
            }

            Spacer(Modifier.height(16.dp))
        }

        ConfirmButton(
            label = if (submitting) "সংরক্ষণ হচ্ছে…" else "নিশ্চিত",
            enabled = canSubmit,
            modifier = Modifier.padding(horizontal = 16.dp),
            onClick = { submit() },
        )
        Spacer(Modifier.height(16.dp))
        Spacer(Modifier.navigationBarsPadding())
    }
}

@Composable
private fun LedgerRow(entry: LedgerEntryItem) {
    val income = entry.tone == "in"
    val color = if (income) TallyColors.AmountGreen else TallyColors.AmountRed
    val circle = if (income) TallyColors.RowGreenCircle else TallyColors.RowRedCircle

    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(circle),
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(
                if (income) TallyIcons.HandReceive else TallyIcons.HandGive,
                if (income) TallyColors.RowGreenIcon else TallyColors.RowRedIcon,
                20.dp,
                strokeWidth = 1.7f,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(entry.title, fontSize = 14.5.sp, color = TallyColors.TextPrimary, maxLines = 1)
            Text(
                text = listOf(entry.dateDisplay, entry.description)
                    .filter { it.isNotBlank() }
                    .joinToString(" · "),
                fontSize = 12.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        Text(
            text = entry.amountDisplay,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            maxLines = 1,
        )
    }
}

/** Dashed blue "টালি-মেসেজ অবশিষ্ট" hint box. */
@Composable
private fun InfoBox(smsLabel: String) {
    val dash = remember { PathEffect.dashPathEffect(floatArrayOf(16f, 12f), 0f) }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(TallyColors.InfoBg)
            .drawBehind {
                drawRoundRect(
                    color = TallyColors.InfoBlue,
                    topLeft = Offset(0f, 0f),
                    size = Size(size.width, size.height),
                    cornerRadius = CornerRadius(8.dp.toPx()),
                    style = Stroke(width = 1.5.dp.toPx(), pathEffect = dash),
                )
            }
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(TallyColors.InfoBlue),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "i",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                text = smsLabel,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = "টালি-মেসেজের মাধ্যমে টালিখাতা থেকে লেনদেনর মেসেজ পাঠানা যায়।",
                fontSize = 13.5.sp,
                color = TallyColors.TextBody,
                lineHeight = 19.sp,
            )
        }
    }
}
