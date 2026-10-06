package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.workbuddy.tallyclone.data.BN_WEEKDAYS_SHORT
import com.workbuddy.tallyclone.data.bengaliMonthYear
import com.workbuddy.tallyclone.data.dateAtNoon
import com.workbuddy.tallyclone.data.localDayOf
import com.workbuddy.tallyclone.data.monthGrid
import com.workbuddy.tallyclone.data.toBengaliDigits
import java.time.LocalDate
import java.time.YearMonth
import java.util.Date

/**
 * The calendar behind the date pill on the ledger and ক্যাশ forms.
 *
 * Hand-rolled rather than material3's `DatePickerDialog` for two reasons: the
 * material one renders its month header in the device locale (English here), and
 * this app never shows a Latin numeral or an English month name anywhere else.
 * Everything the user reads here — month, year, weekday headers, day numbers —
 * is Bengali, matching what the server sends back in `dateDisplay`.
 */
@Composable
fun TallyDatePickerDialog(
    initial: Date,
    onDismiss: () -> Unit,
    onConfirm: (Date) -> Unit,
) {
    val initialDay = localDayOf(initial)
    var month by remember { mutableStateOf(YearMonth.from(initialDay)) }
    var selected by remember { mutableStateOf(initialDay) }
    val today = LocalDate.now()

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(TallyColors.PageWhite)
                .padding(horizontal = 14.dp, vertical = 14.dp),
        ) {
            // --- month header + steppers --------------------------------
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                MonthStepper(TallyIcons.ChevronLeft, "আগের মাস") { month = month.minusMonths(1) }
                Text(
                    text = bengaliMonthYear(month.monthValue, month.year),
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                )
                MonthStepper(TallyIcons.ChevronRight, "পরের মাস") { month = month.plusMonths(1) }
            }

            Spacer(Modifier.height(10.dp))

            // --- weekday headers ----------------------------------------
            Row(Modifier.fillMaxWidth()) {
                BN_WEEKDAYS_SHORT.forEach { label ->
                    Text(
                        text = label,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = TallyColors.TextHint,
                        maxLines = 1,
                    )
                }
            }

            Spacer(Modifier.height(2.dp))

            // --- day grid ------------------------------------------------
            monthGrid(month.year, month.monthValue).forEach { week ->
                Row(Modifier.fillMaxWidth()) {
                    week.forEach { day ->
                        Box(
                            Modifier.weight(1f).height(38.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (day != null) {
                                DayCell(
                                    day = day,
                                    selected = day == selected,
                                    today = day == today,
                                    onSelect = { selected = day },
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            Hairline()
            Spacer(Modifier.height(10.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                PillButton(
                    label = "বাতিল",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextPrimary,
                    bold = false,
                    onClick = onDismiss,
                )
                Spacer(Modifier.width(10.dp))
                PillButton(
                    // Deliberately not "নিশ্চিত": the form underneath has a নিশ্চিত
                    // button of its own, and two identical labels on screen make
                    // every text-based assertion ambiguous.
                    label = "ঠিক আছে",
                    background = TallyColors.CtaRed,
                    textColor = Color.White,
                    onClick = {
                        onConfirm(dateAtNoon(selected.year, selected.monthValue, selected.dayOfMonth))
                    },
                )
            }
        }
    }
}

@Composable
private fun MonthStepper(icon: List<String>, description: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(34.dp)
            .clip(CircleShape)
            // The stepper is icon-only, so the label is the only handle a screen
            // reader — or a test — has on it.
            .semantics { contentDescription = description }
            .clickable(onClickLabel = description) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        LineIcon(icon, TallyColors.TextPrimary, 20.dp, strokeWidth = 2f)
    }
}

@Composable
private fun DayCell(day: LocalDate, selected: Boolean, today: Boolean, onSelect: () -> Unit) {
    val shape = CircleShape
    val bg = if (selected) TallyColors.CtaRed else Color.Transparent
    val ring = if (today && !selected) Modifier.border(1.5.dp, TallyColors.CtaRed, shape) else Modifier
    Box(
        Modifier
            .size(34.dp)
            .clip(shape)
            .background(bg)
            .then(ring)
            .clickable { onSelect() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = toBengaliDigits(day.dayOfMonth),
            fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = when {
                selected -> Color.White
                today -> TallyColors.CtaRed
                else -> TallyColors.TextPrimary
            },
            maxLines = 1,
        )
    }
}
