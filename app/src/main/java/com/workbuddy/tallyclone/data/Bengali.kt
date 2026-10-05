package com.workbuddy.tallyclone.data

/**
 * Bengali numerals for the few places the UI renders a raw count (menu badges).
 * Everything else arrives pre-formatted from the API.
 */
private val BN_DIGITS = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')

fun toBengaliDigits(value: Int): String = toBengaliDigits(value.toString())

fun toBengaliDigits(value: String): String = buildString(value.length) {
    value.forEach { c ->
        if (c in '0'..'9') append(BN_DIGITS[c - '0']) else append(c)
    }
}
