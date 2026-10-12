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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.OwnerReportData
import com.workbuddy.tallyclone.data.OwnerReportDayItem

/**
 * মালিকের রিপোর্ট — the owner's deposits and withdrawals.
 *
 * The previous version of this screen invented its own numbers: with no entries
 * it rendered a row reading "৫,২১১.০০" and a matching total, so an account that
 * had never seen a single owner movement was shown a balance of ৫,২১১. A report
 * that fabricates a plausible figure when it has no data is worse than an empty
 * one — there is no way to tell the two apart on screen.
 *
 * It also listed one row per entry. The reference groups by day, which is what
 * makes মোট mean anything: two deposits and a withdrawal on the same afternoon
 * are one ১২ অক্টোবর row, not three rows all carrying that date.
 *
 * The whole period comes down from the server, so this is a pure renderer.
 */
@Composable
fun OwnerReportScreen(
    report: OwnerReportData?,
    onBack: () -> Unit,
    onLoadPeriod: (String?) -> Unit = {},
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        // --- toolbar ------------------------------------------------------
        Column {
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(start = 8.dp, end = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clickable { onBack() },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.ArrowLeft, TallyColors.TextPrimary, 24.dp, strokeWidth = 2.2f)
                }
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "মালিকের রিপোর্ট",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                )
            }
            Hairline()
        }

        // --- period bar: মাস v | [Cal] অক্টোবর < > -------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFFF3F4F6))
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("মাস", fontSize = 13.5.sp, color = Color(0xFF374151))
                Spacer(Modifier.width(6.dp))
                LineIcon(TallyIcons.ChevronDown, Color(0xFF4B5563), 14.dp, strokeWidth = 2f)
            }

            Spacer(Modifier.width(10.dp))

            Row(
                Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFFF3F4F6))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LineIcon(TallyIcons.Calendar, Color(0xFF6B7280), 16.dp, strokeWidth = 1.7f)
                Spacer(Modifier.width(6.dp))
                Text(
                    text = report?.periodLabel ?: "…",
                    fontSize = 13.5.sp,
                    color = Color(0xFF374151),
                )
                Spacer(Modifier.width(10.dp))
                Box(
                    Modifier
                        .size(20.dp)
                        .clickable {
                            onLoadPeriod(shiftPeriod("month", report?.periodKey, -1))
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.ChevronLeft, Color(0xFF6B7280), 14.dp, strokeWidth = 1.8f)
                }
                Spacer(Modifier.width(16.dp))
                Box(
                    Modifier
                        .size(20.dp)
                        .clickable(enabled = report?.canNext == true) {
                            onLoadPeriod(shiftPeriod("month", report?.periodKey, 1))
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(
                        TallyIcons.ChevronRight,
                        // The arrows never walk into the future, so the disabled
                        // one has to look disabled.
                        if (report?.canNext == true) Color(0xFF6B7280) else Color(0xFFC7CBD1),
                        14.dp,
                        strokeWidth = 1.8f,
                    )
                }
            }
        }

        // --- table header -------------------------------------------------
        Row(
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(Color(0xFFF3F4F6))
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(Modifier.weight(1.3f), verticalAlignment = Alignment.CenterVertically) {
                Text("বিবরণ", fontSize = 14.sp, color = Color(0xFF4B5563))
                Spacer(Modifier.width(6.dp))
                Box(
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE5E7EB)),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Download, Color(0xFF4B5563), 13.dp, strokeWidth = 1.8f)
                }
            }
            Text(
                text = "মালিক দিল",
                fontSize = 14.sp,
                color = Color(0xFF4B5563),
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "মালিক নিল",
                fontSize = 14.sp,
                color = Color(0xFF4B5563),
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }

        // --- rows ---------------------------------------------------------
        val rows = report?.rows.orEmpty()
        if (rows.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    text = if (report == null) "লোড হচ্ছে…" else "এই মাসে কোনো মালিক লেনদেন নেই",
                    fontSize = 14.sp,
                    color = Color(0xFF9CA3AF),
                )
            }
        } else {
            LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
                items(rows) { day -> OwnerReportRow(day) }
            }
        }

        // --- pinned totals ------------------------------------------------
        Column(Modifier.fillMaxWidth().background(Color.White)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "মোট",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier
                        .weight(1.3f)
                        .padding(start = 14.dp),
                )
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .background(Color(0xFFF1F3F5)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = report?.totalGave ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF108A00),
                    )
                }
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .padding(end = 14.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Text(
                        text = report?.totalTook ?: "০.০০",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD32F2F),
                    )
                }
            }

            Box(
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFE5E7EB)),
            )

            Row(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "ব্যালেন্স",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1F2937),
                    modifier = Modifier.weight(1.3f),
                )
                Text(
                    text = report?.balance ?: "০.০০",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    // More withdrawn than deposited is a real answer, not an
                    // error, so the sign is kept and the colour follows it.
                    color = if (report?.balanceNegative == true) Color(0xFFD32F2F) else Color(0xFF1F2937),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

/** One day: what the owner put in and took out that day, already summed. */
@Composable
private fun OwnerReportRow(day: OwnerReportDayItem) {
    Column(
        Modifier
            .fillMaxWidth()
            .drawBehind {
                val strokeWidth = 1.dp.toPx()
                val y = size.height - strokeWidth / 2
                drawLine(
                    color = Color(0xFFD1D5DB),
                    start = Offset(14.dp.toPx(), y),
                    end = Offset(size.width - 14.dp.toPx(), y),
                    strokeWidth = strokeWidth,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f),
                )
            },
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = day.dateLabel,
                fontSize = 13.sp,
                color = Color(0xFF6B7280),
                modifier = Modifier.weight(1.3f),
            )
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .background(if (day.gaveDisplay != "০.০০") Color(0xFFF0FDF4) else Color.Transparent),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = day.gaveDisplay,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF108A00),
                )
            }
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxSize(),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Text(
                    text = day.tookDisplay,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFD32F2F),
                )
            }
        }
    }
}
