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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.toBengaliDate
import kotlinx.coroutines.launch
import java.util.Date

/**
 * ক্যাশ বেচা - the cash entry form with the built-in calculator keypad.
 * Layout mirrors the reference dump (720x1520 @ 1.75x):
 *   toolbar 56-154 | পেলাম 190-292 | বিবরণ 320-422 | date row 443-505
 *   নিশ্চিত 924-1015 | keypad 1043-1381
 *
 * Submitting POSTs a cashbox entry and returns to the ক্যাশবক্স dashboard,
 * which reloads with the new totals.
 */
@Composable
fun CashSellScreen(
    store: AppStore,
    onBack: () -> Unit,
    onOpenReport: () -> Unit,
    kind: String = "cash_sale",
    title: String = "ক্যাশ বেচা",
    amountLabel: String = "পেলাম",
) {
    val scope = rememberCoroutineScope()
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    // Same contract as the ledger form: the pill's date is the posted date.
    var entryDate by remember { mutableStateOf(Date()) }
    var showDatePicker by remember { mutableStateOf(false) }

    val canSubmit = amount.isNotBlank() && !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        scope.launch {
            val result = store.addCashboxEntry(kind, amount.trim(), description.trim(), entryDate)
            submitting = false
            if (result.isSuccess) onBack()
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))

        // --- toolbar ------------------------------------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(start = 8.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(40.dp).clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(TallyIcons.ChevronLeft, TallyColors.TextPrimary, 24.dp, strokeWidth = 2.2f)
            }
            Spacer(Modifier.width(6.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
                Spacer(Modifier.height(1.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("বর্তমান ক্যাশ", fontSize = 12.sp, color = TallyColors.TextSecondary)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = store.cashbox?.currentCash ?: "০.০০",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.TextPrimary,
                    )
                }
            }
            PillButton(
                label = "রিপোর্ট",
                background = TallyColors.SoftPill,
                textColor = TallyColors.TextPrimary,
                icon = TallyIcons.Document,
                onClick = onOpenReport,
            )
        }
        Hairline()

        ErrorBanner(store) { submit() }

        // --- form ---------------------------------------------------------
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            TallyField(
                value = amount,
                onValueChange = { amount = it },
                placeholder = amountLabel,
                prefix = "৳",
            )
            Spacer(Modifier.height(14.dp))
            TallyField(
                value = description,
                onValueChange = { description = it },
                placeholder = "বিবরণ",
                icon = TallyIcons.NoteEdit,
            )
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                PillButton(
                    label = toBengaliDate(entryDate),
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    icon = TallyIcons.Calendar,
                    bold = false,
                    onClick = { showDatePicker = true },
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
        }

        // --- confirm + keypad pinned to the bottom ------------------------
        ConfirmButton(
            label = if (submitting) "সংরক্ষণ হচ্ছে…" else "নিশ্চিত",
            enabled = canSubmit,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            onClick = { submit() },
        )
        CalculatorKeypad(
            onKey = { key ->
                when (key) {
                    "AC" -> amount = ""
                    "⌫" -> amount = amount.dropLast(1)
                    "." -> if (!amount.contains('.')) amount += "."
                    in listOf("+", "-", "X", "÷", "%", "=") -> Unit
                    else -> amount += key
                }
            },
        )
        Spacer(Modifier.navigationBarsPadding())
    }

    if (showDatePicker) {
        TallyDatePickerDialog(
            initial = entryDate,
            onDismiss = { showDatePicker = false },
            onConfirm = {
                entryDate = it
                showDatePicker = false
            },
        )
    }
}

/**
 * 4-column calculator pad matching the reference key layout:
 * AC % ÷ X / 7 8 9 - / 4 5 6 + / 1 2 3 = / ⌫ 0 . (blank)
 */
@Composable
private fun CalculatorKeypad(onKey: (String) -> Unit) {
    val rows = listOf(
        listOf("AC", "%", "÷", "X"),
        listOf("7", "8", "9", "-"),
        listOf("4", "5", "6", "+"),
        listOf("1", "2", "3", "="),
        listOf("⌫", "0", ".", ""),
    )
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFFF1F1F1)),
    ) {
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth().height(46.dp)) {
                row.forEach { key ->
                    CalculatorKey(
                        label = key,
                        modifier = Modifier.weight(1f),
                        accent = key == "=",
                        onKey = onKey,
                    )
                }
            }
        }
    }
}

@Composable
private fun CalculatorKey(
    label: String,
    modifier: Modifier,
    accent: Boolean,
    onKey: (String) -> Unit,
) {
    val operators = listOf("AC", "%", "÷", "X", "-", "+")
    val bg = when {
        accent -> TallyColors.CtaRed
        label in operators -> Color(0xFFE6E6E6)
        else -> Color(0xFFF7F7F7)
    }
    val fg = when {
        accent -> Color.White
        label in operators -> TallyColors.TextBody
        else -> TallyColors.TextPrimary
    }
    Box(
        modifier
            .fillMaxSize()
            .padding(0.5.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(bg)
            .clickable(enabled = label.isNotEmpty()) { onKey(label) },
        contentAlignment = Alignment.Center,
    ) {
        if (label.isNotEmpty()) {
            Text(
                text = label,
                fontSize = if (label.length > 1) 15.sp else 20.sp,
                fontWeight = FontWeight.Medium,
                color = fg,
            )
        }
    }
}
