package com.workbuddy.tallyclone.data

import java.time.ZoneId
import java.util.Date

/**
 * Bengali numerals for the few places the UI renders a raw count (menu badges,
 * the date pills). Everything else arrives pre-formatted from the API.
 */
private val BN_DIGITS = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')

fun toBengaliDigits(value: Int): String = toBengaliDigits(value.toString())

fun toBengaliDigits(value: String): String = buildString(value.length) {
    value.forEach { c ->
        if (c in '0'..'9') append(BN_DIGITS[c - '0']) else append(c)
    }
}

/**
 * Bengali month names, mirroring `web/lib/bengali.ts` so a date the app renders
 * and the same date the server echoes back in `dateDisplay` read identically.
 */
val BN_MONTHS = listOf(
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
)

/** Two ASCII digits, ready for [toBengaliDigits]. Avoids locale-dependent padding. */
private fun pad2(n: Int): String = if (n < 10) "0$n" else n.toString()

private fun localDate(date: Date) =
    date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate()

/** "০৪ অক্টোবর, ২৬" — the long date pill. Mirrors the server's `dateBn`. */
fun toBengaliDate(date: Date): String {
    val d = localDate(date)
    return "${toBengaliDigits(pad2(d.dayOfMonth))} ${BN_MONTHS[d.monthValue - 1]}, " +
        toBengaliDigits(pad2(d.year % 100))
}

/** "০৪ অক্টোবর" — the short date pill on the ledger form. Mirrors `dateShortBn`. */
fun toBengaliDateShort(date: Date): String {
    val d = localDate(date)
    return "${toBengaliDigits(pad2(d.dayOfMonth))} ${BN_MONTHS[d.monthValue - 1]}"
}

/**
 * The wire format for a picked calendar date.
 *
 * Noon, not midnight, and no timezone suffix. A bare `YYYY-MM-DD` is parsed as UTC
 * midnight, which falls on the *previous* day for any server west of Greenwich —
 * a picked date of the 4th would come back as the 3rd. A local-time noon cannot be
 * pushed across a day boundary by any real UTC offset, so the day the user tapped
 * is the day that is stored.
 */
fun toWireDate(date: Date): String {
    val d = localDate(date)
    val year = d.year.toString().padStart(4, '0')
    return "$year-${pad2(d.monthValue)}-${pad2(d.dayOfMonth)}T12:00:00"
}
