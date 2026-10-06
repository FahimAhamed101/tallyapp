package com.workbuddy.tallyclone.data

import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.util.Date

/**
 * Calendar maths for the date pill, kept pure and separate from the composable so
 * the parts that are easy to get wrong (month length, leap years, the weekday the
 * month starts on) can be tested without rendering anything.
 */

/** Sunday-first weekday headers, as the reference calendar shows them. */
val BN_WEEKDAYS_SHORT = listOf("রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি")

/** 1-based month -> "অক্টোবর". */
fun bengaliMonthName(month: Int): String = BN_MONTHS[month - 1]

/** (10, 2026) -> "অক্টোবর ২০২৬" — the picker's header. */
fun bengaliMonthYear(month: Int, year: Int): String =
    "${bengaliMonthName(month)} ${toBengaliDigits(year)}"

/** The calendar day a [Date] falls on, in the device's zone. */
fun localDayOf(date: Date): LocalDate =
    date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate()

/**
 * A [Date] that sits at *noon local* on the given day.
 *
 * Noon rather than midnight for the same reason [toWireDate] uses noon: it is the
 * one time of day no real UTC offset can push across a date boundary, so the day
 * the user tapped survives both the wire round-trip and [localDayOf].
 */
fun dateAtNoon(year: Int, month: Int, day: Int): Date =
    Date(
        LocalDate.of(year, month, day)
            .atTime(12, 0)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli(),
    )

/** The number of rows a month needs, so short months don't render a blank week. */
fun weeksInMonth(year: Int, month: Int): Int {
    val first = LocalDate.of(year, month, 1)
    val lead = first.dayOfWeek.value % 7 // MONDAY(1)..SUNDAY(7) -> Sunday-first column
    return (lead + YearMonth.of(year, month).lengthOfMonth() + 6) / 7
}

/**
 * A Sunday-first grid for the given month, one list per week, 7 cells per week.
 * Cells outside the month are `null` so the caller can render a gap.
 */
fun monthGrid(year: Int, month: Int): List<List<LocalDate?>> {
    val first = LocalDate.of(year, month, 1)
    val lead = first.dayOfWeek.value % 7
    val cells = ArrayList<LocalDate?>(42)
    repeat(lead) { cells.add(null) }
    for (day in 1..YearMonth.of(year, month).lengthOfMonth()) {
        cells.add(LocalDate.of(year, month, day))
    }
    while (cells.size % 7 != 0) cells.add(null)
    return cells.chunked(7)
}
