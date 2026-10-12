package com.workbuddy.tallyclone.ui

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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CashEntryReceipt
import com.workbuddy.tallyclone.data.cashEntryInflow
import com.workbuddy.tallyclone.data.toBengaliDate
import com.workbuddy.tallyclone.data.toBengaliDigits
import kotlinx.coroutines.launch
import java.util.Date
import java.util.Locale

/**
 * The five cash forms: ক্যাশ বেচা / ক্যাশ কেনা / খরচ / মালিক দিল / মালিক নিল.
 *
 * Two things about the reference this follows and the previous version did not:
 *
 *  - The fields are boxed with their labels **on the border**. The old form used
 *    placeholder labels, so a filled form stopped saying what its fields were.
 *  - There is no built-in keypad. The reference raises the system keyboard here
 *    (only ক্যাশবক্স মিলাই has a pad of its own), which is also the only way a
 *    বিবরণ can be typed at all — a description is a sentence, and the old
 *    single-line 56dp box clipped it after a few words.
 *
 * Money leaving the drawer that the drawer cannot cover is caught before it is
 * sent, and the user is offered the two ways to top the box up.
 */
@Composable
fun CashSellScreen(
    store: AppStore,
    onBack: () -> Unit,
    onOpenReport: () -> Unit,
    onOpenForm: (String) -> Unit = {},
    onDone: (CashEntryReceipt) -> Unit = {},
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
    var showShortfall by remember { mutableStateOf(false) }
    // ছবি pill: the picked photo uploads immediately (the Cloudinary secret
    // stays server-side) and its URL rides along with the entry on নিশ্চিত.
    val photo = rememberPhotoAttach(store, folder = "cashbox")

    val numeric = parseTallyAmount(amount)
    val canSubmit = numeric > 0 && !submitting && !photo.uploading

    val inflow = cashEntryInflow(kind)
    val available = store.cashbox?.currentCashRaw ?: 0.0
    val shortfall = numeric - available

    // Only the two transaction-like forms carry a date and a photo. The
    // reference's খরচ / মালিক দিল / মালিক নিল forms show neither.
    val withDateAndPhoto = kind == "cash_sale" || kind == "cash_purchase"

    fun performSubmit() {
        submitting = true
        scope.launch {
            val result = store.addCashboxEntry(
                kind = kind,
                amount = amount.trim(),
                description = description.trim(),
                date = entryDate,
                photoUrl = photo.photoUrl.takeIf { it.isNotBlank() },
                photoPublicId = photo.photoPublicId.takeIf { it.isNotBlank() },
            )
            submitting = false
            result.onSuccess {
                // The receipt screen is where the entry is considered landed, so
                // the pill resets only then — a failed post keeps the photo.
                photo.clear()
                onDone(it)
            }
        }
    }

    fun submit() {
        if (!canSubmit) return
        // Money out of a drawer that does not hold it: warn first and offer the
        // two ways to top it up. This is the only thing standing between a
        // mistyped খরচ and a negative cash box.
        if (!inflow && shortfall > 0.004) {
            showShortfall = true
            return
        }
        performSubmit()
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
                background = TallyColors.ReportPill,
                textColor = TallyColors.CtaRed,
                icon = TallyIcons.Document,
                iconColor = TallyColors.CtaRed,
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
            Spacer(Modifier.height(18.dp))
            TallyLabelledField(
                label = amountLabel,
                value = amount,
                onValueChange = { amount = it },
                prefix = "৳",
                keyboardType = KeyboardType.Decimal,
            )
            Spacer(Modifier.height(18.dp))
            TallyLabelledField(
                label = "বিবরণ",
                value = description,
                onValueChange = { description = it },
                icon = TallyIcons.NoteEdit,
                singleLine = false,
                minHeight = 88.dp,
            )
            if (withDateAndPhoto) {
                Spacer(Modifier.height(16.dp))
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
                    PhotoPill(attach = photo)
                }
                val photoError = photo.error
                if (photoError != null) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = photoError,
                        fontSize = 12.sp,
                        color = TallyColors.CtaRed,
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        ConfirmButton(
            label = if (submitting) "সংরক্ষণ হচ্ছে…" else "নিশ্চিত",
            enabled = canSubmit,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            onClick = { submit() },
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

    // ছবি source sheet: camera / gallery / remove.
    PhotoAttachSheet(photo)

    if (showShortfall) {
        ShortfallDialog(
            shortfall = shortfall,
            paid = numeric,
            currentCash = available,
            onDismiss = { showShortfall = false },
            onAddCash = { shortcut ->
                showShortfall = false
                onOpenForm(shortcut)
            },
            onConfirm = {
                showShortfall = false
                performSubmit()
            },
        )
    }
}

/**
 * "ক্যাশে ঘাটতি" — a withdrawal bigger than the drawer.
 *
 * The reference shows the shortfall, the amount being paid out and what the
 * drawer actually holds, then offers the two ways to put cash in rather than
 * simply refusing. Confirming anyway is allowed: an expense can legitimately be
 * recorded before the sale that pays for it, and the box is allowed to show the
 * overdraft rather than silently accepting a wrong number.
 */
@Composable
private fun ShortfallDialog(
    shortfall: Double,
    paid: Double,
    currentCash: Double,
    onDismiss: () -> Unit,
    onAddCash: (String) -> Unit,
    onConfirm: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color.White)
                .padding(horizontal = 18.dp, vertical = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("ক্যাশে ঘাটতি", fontSize = 15.sp, color = TallyColors.TextPrimary)
            Spacer(Modifier.height(6.dp))
            Text(
                text = bengaliAmount(shortfall),
                fontSize = 23.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.ZeroRed,
            )
            Spacer(Modifier.height(16.dp))

            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(TallyColors.FieldGray)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                ShortfallRow("দিলাম", bengaliAmount(paid), TallyColors.ZeroRed)
                Spacer(Modifier.height(8.dp))
                ShortfallRow("বর্তমান ক্যাশ", bengaliAmount(currentCash), TallyColors.TextPrimary)
            }

            Spacer(Modifier.height(18.dp))
            Text(
                text = "ঘাটতি পূরেণর জন্য ক্যাশ পাওয়ার এন্ট্রি দেই।",
                fontSize = 15.sp,
                color = TallyColors.TextPrimary,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(18.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ShortcutButton("ক্যাশ বেচা", Modifier.weight(1f)) { onAddCash("cash_sale") }
                ShortcutButton("মালিক দিল", Modifier.weight(1f)) { onAddCash("owner_in") }
            }

            Spacer(Modifier.height(20.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                DialogAction("বাতিল", onDismiss)
                DialogAction("নিশ্চিত", onConfirm)
            }
        }
    }
}

@Composable
private fun ShortfallRow(label: String, value: String, valueColor: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 14.sp, color = TallyColors.TextSecondary, modifier = Modifier.weight(1f))
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = valueColor)
    }
}

/** The dialog's two "put money in" shortcuts — outlined, with the ৳ prefix. */
@Composable
private fun ShortcutButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .height(48.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, TallyColors.FieldBorder, RoundedCornerShape(8.dp))
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text("৳", fontSize = 16.sp, color = TallyColors.TextSecondary)
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 14.5.sp, color = TallyColors.TextSecondary, maxLines = 1)
    }
}

@Composable
private fun DialogAction(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        color = TallyColors.TextSecondary,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 22.dp, vertical = 8.dp),
    )
}

/**
 * "লেনদেনটি রেকর্ড করা হয়েছে।" — the confirmation after a cash entry lands.
 *
 * Shows the drawer before, the entry itself, and the drawer after, which is the
 * one thing a toast cannot tell you: whether the number you expected actually
 * moved. The reference has no button here, so neither does this — but the whole
 * surface is tappable, because a screen with no visible way out and no auto
 * dismiss is a dead end for anyone who does not reach for the back gesture.
 */
@Composable
fun CashDoneScreen(receipt: CashEntryReceipt, onBack: () -> Unit) {
    val inflow = cashEntryInflow(receipt.kind)

    Box(Modifier.fillMaxSize().background(TallyColors.PageWhite).clickable { onBack() }) {
        Column(
            Modifier
                .fillMaxSize().padding(horizontal = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
            Spacer(Modifier.weight(1f))

            Box(
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(TallyColors.DeboGreen),
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(TallyIcons.Check, Color.White, 38.dp, strokeWidth = 2.6f)
            }

            Spacer(Modifier.height(22.dp))
            Text(
                text = "লেনদেনটি রেকর্ড করা হয়েছে।",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(34.dp))
            Column(Modifier.fillMaxWidth()) {
                ReceiptRow("পূর্বের ক্যাশ", receipt.beforeCash, TallyColors.TextPrimary)
                Spacer(Modifier.height(12.dp))
                ReceiptRow(
                    receipt.label,
                    receipt.amountDisplay,
                    if (inflow) TallyColors.ZeroGreen else TallyColors.ZeroRed,
                )
                Spacer(Modifier.height(12.dp))
                Hairline()
                Spacer(Modifier.height(12.dp))
                ReceiptRow("বর্তমান ক্যাশ", receipt.afterCash, TallyColors.TextPrimary, bold = true)
            }

            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ReceiptRow(label: String, value: String, valueColor: Color, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = 14.5.sp,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = if (bold) TallyColors.TextPrimary else TallyColors.TextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor,
        )
    }
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

private const val BN_DIGITS = "০১২৩৪৫৬৭৮৯"

/**
 * A typed amount as a number.
 *
 * The fields accept Bengali digits — the server takes them everywhere else, and
 * a keypad on a Bengali phone produces them — so the shortfall check has to read
 * them too rather than silently treating "৫০০০" as zero. Grouping commas are
 * dropped for the same reason.
 */
internal fun parseTallyAmount(raw: String): Double {
    val ascii = buildString(raw.length) {
        raw.forEach { c ->
            val i = BN_DIGITS.indexOf(c)
            append(if (i >= 0) ('0' + i) else c)
        }
    }
    return ascii.filter { it.isDigit() || it == '.' }.toDoubleOrNull() ?: 0.0
}

/** 5200.0 -> "৫,২০০.০০", byte-identical to the server's `amount()`. */
internal fun bengaliAmount(value: Double): String {
    val negative = value < -0.004
    val fixed = String.format(Locale.US, "%.2f", kotlin.math.abs(value))
    val whole = fixed.substringBefore('.')
    val frac = fixed.substringAfter('.')
    val grouped = whole.reversed().chunked(3).joinToString(",").reversed()
    return (if (negative) "-" else "") + toBengaliDigits("$grouped.$frac")
}
