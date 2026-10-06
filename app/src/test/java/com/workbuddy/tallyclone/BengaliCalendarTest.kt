package com.workbuddy.tallyclone

import com.workbuddy.tallyclone.data.bengaliMonthName
import com.workbuddy.tallyclone.data.bengaliMonthYear
import com.workbuddy.tallyclone.data.dateAtNoon
import com.workbuddy.tallyclone.data.localDayOf
import com.workbuddy.tallyclone.data.monthGrid
import com.workbuddy.tallyclone.data.toBengaliDate
import com.workbuddy.tallyclone.data.toBengaliDateShort
import com.workbuddy.tallyclone.data.toWireDate
import com.workbuddy.tallyclone.data.weeksInMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Date

/**
 * The date maths behind the date pill, tested without rendering anything.
 *
 * These are the parts a screenshot cannot check and a Robolectric render only
 * checks indirectly: which column the 1st lands in, whether a short month leaves
 * a blank week behind, whether February knows about leap years, and — the one
 * that actually corrupts data — whether the day the user tapped is the day that
 * gets stored.
 *
 * Weekday anchors are hard-coded on purpose. Oct 1 2026 is a Thursday, Feb 1
 * 2026 a Sunday, Feb 1 2024 a Thursday; deriving them from the same code under
 * test would make the assertion vacuous.
 */
class BengaliCalendarTest {

    private val zone = ZoneId.systemDefault()

    // ---- the grid ---------------------------------------------------------

    @Test
    fun theFirstOfTheMonthLandsInTheColumnForItsWeekday() {
        // Oct 1 2026 is a Thursday. Sunday-first columns: রবি সোম মঙ্গল বুধ বৃহ ->
        // index 4.
        val grid = monthGrid(2026, 10)
        val flat = grid.flatten()
        val lead = flat.indexOfFirst { it != null }

        assertEquals("the 1st must sit in column 4 (Thursday)", 4, lead)
        assertEquals(LocalDate.of(2026, 10, 1), flat[lead])
    }

    @Test
    fun everyCellBelongsToTheRequestedMonthAndAscendsWithoutGaps() {
        listOf(2024 to 2, 2025 to 12, 2026 to 1, 2026 to 10, 2027 to 6).forEach { (y, m) ->
            val days = monthGrid(y, m).flatten().filterNotNull()
            val expected = LocalDate.of(y, m, 1).let { first ->
                (1..first.lengthOfMonth()).map { LocalDate.of(y, m, it) }
            }
            assertEquals("grid contents for $y-$m", expected, days)
        }
    }

    @Test
    fun aShortMonthNeverRendersATrailingBlankWeek() {
        // Feb 2026 starts on a Sunday and has 28 days: exactly four rows. A naive
        // "always emit six rows" grid would render two weeks of empty cells.
        assertEquals(4, weeksInMonth(2026, 2))
        assertEquals(4, monthGrid(2026, 2).size)

        // Feb 2024 starts Thursday (+4 lead) with 29 days -> 33 cells -> 5 rows.
        assertEquals(5, weeksInMonth(2024, 2))
        assertEquals(5, monthGrid(2024, 2).size)
    }

    @Test
    fun noMonthEverProducesAnAllBlankRow() {
        // The invariant behind the test above, swept across four years so a
        // hand-picked month can't hide the failure.
        for (year in 2024..2027) {
            for (month in 1..12) {
                monthGrid(year, month).forEachIndexed { i, week ->
                    assertEquals(7, week.size)
                    assertTrue(
                        "row $i of $year-$month is entirely blank",
                        week.any { it != null },
                    )
                }
            }
        }
    }

    @Test
    fun theGridIsPaddedToWholeWeeks() {
        monthGrid(2026, 10).forEach { assertEquals(7, it.size) }

        // October 2026 starts on a Thursday, so four leading cells are blank and
        // the 4 + 31 = 35 cells land exactly on five weeks — no trailing padding.
        val oct = monthGrid(2026, 10).flatten()
        assertNull(oct[0])
        assertNull(oct[3])
        assertEquals(LocalDate.of(2026, 10, 1), oct[4])
        assertEquals(LocalDate.of(2026, 10, 31), oct.last())

        // November 2026 starts on a Sunday with 30 days: no leading gap, but the
        // grid must still be padded out to a whole week.
        val nov = monthGrid(2026, 11).flatten()
        assertEquals(LocalDate.of(2026, 11, 1), nov[0])
        assertNull(nov.last())
        assertEquals(35, nov.size)
    }

    @Test
    fun februaryLengthTracksLeapYears() {
        assertEquals(29, monthGrid(2024, 2).flatten().count { it != null })
        assertEquals(28, monthGrid(2026, 2).flatten().count { it != null })
        assertEquals(28, monthGrid(2100, 2).flatten().count { it != null }) // century, not leap
        assertEquals(29, monthGrid(2000, 2).flatten().count { it != null }) // century, leap
    }

    // ---- the header -------------------------------------------------------

    @Test
    fun theMonthHeaderIsFullyBengali() {
        assertEquals("অক্টোবর ২০২৬", bengaliMonthYear(10, 2026))
        assertEquals("জানুয়ারি ২০২৫", bengaliMonthYear(1, 2025))
        assertEquals("ডিসেম্বর", bengaliMonthName(12))
        // No Latin digit may survive into the header.
        assertTrue(
            "header leaked a Latin numeral: ${bengaliMonthYear(10, 2026)}",
            bengaliMonthYear(10, 2026).none { it in '0'..'9' },
        )
    }

    // ---- the label, in lockstep with the server ---------------------------

    @Test
    fun thePillLabelsMatchTheServersOwnFormats() {
        val d = dateAtNoon(2026, 10, 4)
        // web/lib/bengali.ts dateBn / dateShortBn, byte for byte.
        assertEquals("০৪ অক্টোবর, ২৬", toBengaliDate(d))
        assertEquals("০৪ অক্টোবর", toBengaliDateShort(d))
    }

    @Test
    fun thePillLabelsPadSingleDigitDaysAndYears() {
        val d = dateAtNoon(2025, 1, 9)
        assertEquals("০৯ জানুয়ারি, ২৫", toBengaliDate(d))
        assertEquals("০৯ জানুয়ারি", toBengaliDateShort(d))
    }

    // ---- the wire format --------------------------------------------------

    @Test
    fun theWireDateIsNoonAndUnqualified() {
        assertEquals("2026-10-04T12:00:00", toWireDate(dateAtNoon(2026, 10, 4)))
        assertEquals("2025-01-09T12:00:00", toWireDate(dateAtNoon(2025, 1, 9)))
    }

    /**
     * The bug this format exists to prevent.
     *
     * `new Date("2026-10-04")` is parsed as UTC midnight, which is still Oct 3 in
     * any negative-offset zone — a picked 4th would be stored as the 3rd. The
     * server parses a bare `YYYY-MM-DDTHH:mm:ss` (no offset) as *local* time, so
     * replicating that parse here proves noon survives the round trip.
     */
    @Test
    fun thePickedDaySurvivesTheServersParseOfTheWireDate() {
        for (day in 1..28) {
            val picked = dateAtNoon(2026, 10, day)
            val wire = toWireDate(picked)
            // What `new Date(wire)` does on the server: no offset -> local time.
            val asServer = Date.from(LocalDateTime.parse(wire).atZone(zone).toInstant())
            assertEquals("day $day round-tripped", picked, asServer)
            assertEquals(LocalDate.of(2026, 10, day), localDayOf(asServer))
        }
    }

    /**
     * The counter-example, kept as executable documentation of *why* the wire
     * format uses noon.
     *
     * A date-only string is defined to be UTC midnight. A server west of
     * Greenwich renders that instant as the previous day, so a picked 4th would
     * be stored — and shown — as the 3rd. This is the bug the noon convention
     * exists to prevent, asserted directly so nobody "simplifies" the format
     * back to `YYYY-MM-DD`.
     */
    @Test
    fun aDateOnlyWireFormatWouldShiftTheDayBackwards() {
        val utcMidnight = Date.from(
            LocalDate.parse("2026-10-04").atStartOfDay(ZoneOffset.UTC).toInstant(),
        )

        // Same instant, read by a server five hours behind Greenwich.
        val asRendered = utcMidnight.toInstant().atZone(ZoneOffset.ofHours(-5)).toLocalDate()
        assertEquals(LocalDate.of(2026, 10, 3), asRendered)

        // The noon form cannot do that: whatever zone reads it, the day is intact.
        val wire = toWireDate(dateAtNoon(2026, 10, 4))
        for (hours in -12..14) {
            val serverZone = ZoneOffset.ofHours(hours)
            val day = LocalDateTime.parse(wire).atZone(serverZone).toLocalDate()
            assertEquals("day shifted for a UTC$hours server", LocalDate.of(2026, 10, 4), day)
        }
    }
}
