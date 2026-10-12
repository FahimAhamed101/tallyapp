package com.workbuddy.tallyclone.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.workbuddy.tallyclone.data.BN_MONTHS
import com.workbuddy.tallyclone.data.toBengaliDigits
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneId

/**
 * The period the three sidebar reports are scoped to, and the state the date bar
 * drives.
 *
 * The bar used to be decoration: its arrows were wired to nothing and
 * `dateLabel` was the literal string "০৬ অক্টোবর", so the rows underneath were
 * simply every entry the store had ever loaded — paging the arrows changed
 * nothing and the date never moved. This is the missing half: one
 * (period, anchor) pair that the bar writes and the rows read.
 *
 * It opens on the current **month**, not the current day. A report that opens
 * empty because the last entry was yesterday reads as broken, while one that
 * opens wide and narrows on a tap does not — and today is inside the current
 * month either way.
 */
internal class ReportPeriodState {
    var period by mutableStateOf("month")
    var anchor by mutableStateOf(LocalDate.now())

    val isDay: Boolean get() = period == "day"

    /** "দিন" or "মাস" — the dropdown's current text. */
    val periodLabel: String get() = if (isDay) "দিন" else "মাস"

    /** "০৪ অক্টোবর" or "অক্টোবর ২০২৬" — the middle of the bar. */
    val dateLabel: String get() = if (isDay) dayLabel(anchor) else monthLabel(anchor)

    /** Move the anchor one day or one month back (`delta < 0`) or forward. */
    fun shift(delta: Int) {
        anchor = if (isDay) anchor.plusDays(delta.toLong()) else anchor.plusMonths(delta.toLong())
    }

    /** Switching period re-anchors on today: the other granularity is a new view. */
    fun selectPeriod(next: String) {
        period = if (next == "day") "day" else "month"
        anchor = LocalDate.now()
    }
}

@Composable
internal fun rememberReportPeriod(): ReportPeriodState = remember { ReportPeriodState() }

/** "০৪ অক্টোবর" — [day], the way the server's own `dateShortBn` writes it. */
internal fun dayLabel(day: LocalDate): String =
    "${toBengaliDigits(day.dayOfMonth.toString().padStart(2, '0'))} ${BN_MONTHS[day.monthValue - 1]}"

/** "অক্টোবর ২০২৬" — the anchor of the month [month] starts on. */
internal fun monthLabel(month: LocalDate): String =
    "${BN_MONTHS[month.monthValue - 1]} ${toBengaliDigits(month.year.toString())}"

/**
 * An API date as the day it falls on **here**.
 *
 * Three shapes reach the app — a UTC instant ("…Z"), an offset instant
 * ("…+06:00"), and the bare local `YYYY-MM-DD` that the forms post — and each
 * needs its own reader; reading all three as UTC would put every evening entry
 * on the previous day for a server east of Greenwich.
 *
 * A date that cannot be read comes back null, and callers keep the row rather
 * than hiding data they could not classify.
 */
internal fun localDayOf(raw: String): LocalDate? {
    val s = raw.trim()
    if (s.isEmpty()) return null
    return runCatching {
        when {
            s.endsWith("Z") ->
                Instant.parse(s).atZone(ZoneId.systemDefault()).toLocalDate()
            s.indexOf('+') > 10 || s.indexOf('-', 10) > 10 ->
                OffsetDateTime.parse(s).atZoneSameInstant(ZoneId.systemDefault()).toLocalDate()
            else -> LocalDate.parse(s.substring(0, minOf(10, s.length)))
        }
    }.getOrNull()
}

/** True when [raw] falls inside [state]'s selected period. An unreadable date passes. */
internal fun inSelectedPeriod(raw: String, state: ReportPeriodState): Boolean {
    val day = localDayOf(raw) ?: return true
    return if (state.isDay) {
        day == state.anchor
    } else {
        YearMonth.from(day) == YearMonth.from(state.anchor)
    }
}
