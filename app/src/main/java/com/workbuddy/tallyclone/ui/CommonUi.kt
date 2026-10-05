package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The gold wash that sits behind the status bar and the toolbar. */
val GoldBrush: Brush = Brush.horizontalGradient(
    listOf(TallyColors.GoldStart, TallyColors.GoldEnd),
)

// ---------------------------------------------------------------------------
// Gold toolbar (shared by টালি / ক্যাশবক্স / ওয়ালেট)
// ---------------------------------------------------------------------------

@Composable
fun GoldHeader(
    businessName: String = "fahim",
    goldLabel: String = "গোল্ড (ট্রায়াল)",
    inboxBadge: Int = 0,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
            .height(60.6.dp)
            .padding(start = 12.dp, end = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.padding(top = 4.dp)) {
            BusinessChip(businessName)
            Spacer(Modifier.height(4.dp))
            Box(Modifier.height(21.dp), contentAlignment = Alignment.CenterStart) {
                Text(
                    text = goldLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                    modifier = Modifier.padding(start = 5.dp),
                )
            }
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.padding(top = 12.5.dp)) {
            ToolbarAction("ইনবক্স", TallyIcons.Inbox, inboxBadge)
            Spacer(Modifier.width(18.dp))
            ToolbarAction("সাপোর্ট", TallyIcons.Support)
        }
    }
}

@Composable
private fun BusinessChip(name: String) {
    Row(
        Modifier
            .height(24.dp)
            .clip(RoundedCornerShape(50))
            .background(TallyColors.CardCream)
            .padding(start = 7.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SolidIcon(TallyIcons.Crown, TallyColors.CrownGold, 22.dp)
        Spacer(Modifier.width(2.dp))
        Text(
            text = name,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.TextPrimary,
            maxLines = 1,
        )
        Spacer(Modifier.width(3.dp))
        LineIcon(TallyIcons.ChevronDown, TallyColors.TextPrimary, 20.dp, strokeWidth = 2.4f)
    }
}

@Composable
private fun ToolbarAction(label: String, paths: List<String>, badge: Int = 0) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box {
            LineIcon(paths, TallyColors.TextPrimary, 20.dp, strokeWidth = 1.8f)
            if (badge > 0) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 7.dp, y = (-6).dp)
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(TallyColors.BadgeRed),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "$badge",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                }
            }
        }
        Spacer(Modifier.height(1.dp))
        Box(Modifier.height(19.dp), contentAlignment = Alignment.Center) {
            Text(label, fontSize = 11.sp, color = TallyColors.TextPrimary, maxLines = 1)
        }
    }
}

// ---------------------------------------------------------------------------
// Bottom navigation (shared by every tab)
// ---------------------------------------------------------------------------

data class TallyTab(val label: String, val paths: List<String>)

val TallyTabs = listOf(
    TallyTab("টালি", TallyIcons.NavTally),
    TallyTab("ক্যাশবক্স", TallyIcons.NavCashbox),
    TallyTab("ওয়ালেট", TallyIcons.NavWallet),
    TallyTab("মেন্যু", TallyIcons.NavMenu),
)

const val TAB_HOME = 0
const val TAB_CASHBOX = 1
const val TAB_WALLET = 2
const val TAB_MENU = 3

@Composable
fun BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(TallyColors.PageWhite)
            .navigationBarsPadding(),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.5.dp)
                .background(TallyColors.DividerGray),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .height(58.dp),
        ) {
            TallyTabs.forEachIndexed { index, tab ->
                val active = index == selected
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable { onSelect(index) }
                        .padding(top = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Top,
                ) {
                    Box(
                        Modifier
                            .width(56.dp)
                            .height(28.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (active) TallyColors.NavRedBg else Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        TabIcon(tab.paths, active)
                    }
                    Spacer(Modifier.height(2.dp))
                    Box(Modifier.height(16.dp), contentAlignment = Alignment.Center) {
                        Text(
                            text = tab.label,
                            fontSize = 10.sp,
                            color = if (active) TallyColors.NavRed else TallyColors.TextSecondary,
                            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        // The reference app leaves this much white below its bottom bar
        // before the system navigation bar starts.
        Spacer(Modifier.height(22.dp))
    }
}

@Composable
private fun TabIcon(paths: List<String>, active: Boolean) {
    // The টালি tab is drawn as a solid red ledger with a light base line,
    // matching the reference; the other tabs stay as plain outlines.
    if (active && paths === TallyIcons.NavTally) {
        Box(Modifier.size(24.dp)) {
            SolidIcon(listOf(paths.first()), TallyColors.NavRed, 24.dp)
            LineIcon(listOf(paths.last()), TallyColors.NavRedBg, 24.dp, strokeWidth = 2.0f)
        }
    } else {
        LineIcon(
            paths = paths,
            color = if (active) TallyColors.NavRed else TallyColors.TextSecondary,
            size = 24.dp,
            strokeWidth = 1.8f,
        )
    }
}

// ---------------------------------------------------------------------------
// Small shared widgets
// ---------------------------------------------------------------------------

/** Light-grey capsule used for রিপোর্ট / ক্যাশবক্স মিলাই / ছবি etc. */
@Composable
fun PillButton(
    label: String,
    background: Color,
    textColor: Color,
    icon: List<String>? = null,
    iconColor: Color = textColor,
    height: androidx.compose.ui.unit.Dp = 34.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 13.sp,
    bold: Boolean = true,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier
            .height(height)
            .clip(RoundedCornerShape(50))
            .background(background)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            LineIcon(icon, iconColor, 18.dp, strokeWidth = 1.8f)
            Spacer(Modifier.width(6.dp))
        }
        Text(
            text = label,
            fontSize = fontSize,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = textColor,
            maxLines = 1,
        )
    }
}

/** Full-width red / pink capsule action button. */
@Composable
fun ConfirmButton(
    label: String = "নিশ্চিত",
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(50))
            .background(if (enabled) TallyColors.CtaRed else TallyColors.DisabledPink)
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )
    }
}

/** Thin full-width hairline. */
@Composable
fun Hairline(color: Color = TallyColors.DividerGray, thickness: androidx.compose.ui.unit.Dp = 1.dp) {
    Box(Modifier.fillMaxWidth().height(thickness).background(color))
}

/** Rounded text field with a leading line-art icon (forms). */
@Composable
fun TallyField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    icon: List<String>? = null,
    prefix: String? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .border(1.dp, TallyColors.FieldBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            LineIcon(icon, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.7f)
            Spacer(Modifier.width(12.dp))
        }
        if (prefix != null) {
            Text(prefix, fontSize = 17.sp, color = TallyColors.TextPrimary)
            Spacer(Modifier.width(8.dp))
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                Text(placeholder, fontSize = 15.sp, color = TallyColors.TextHint, maxLines = 1)
            }
            androidx.compose.foundation.text.BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontSize = 15.sp,
                    color = TallyColors.TextPrimary,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/**
 * Avatar with a camera badge — the tappable photo control on the
 * add/edit customer form. Shows the uploaded photo when there is one, the
 * person glyph otherwise, and a spinner while the upload is in flight.
 */
@Composable
fun AvatarWithCamera(
    photoUrl: String? = null,
    size: androidx.compose.ui.unit.Dp = 58.dp,
    uploading: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    Box(
        Modifier
            .size(size)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
    ) {
        AvatarPreview(photoUrl, size)

        Box(
            Modifier
                .align(Alignment.BottomEnd)
                .size(22.dp)
                .clip(CircleShape)
                .background(if (uploading) TallyColors.NavRed else Color(0xFF8A8A8A))
                .border(1.5.dp, Color.White, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (uploading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(12.dp),
                    color = Color.White,
                    strokeWidth = 1.8.dp,
                )
            } else {
                LineIcon(TallyIcons.Camera, Color.White, 13.dp, strokeWidth = 2.0f)
            }
        }
    }
}

/** Red-outlined radio capsule (কাস্টমার / সাপ্লায়ার). */
@Composable
fun RadioPill(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val border = if (selected) TallyColors.NavRed else TallyColors.FieldBorder
    Row(
        modifier
            .height(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .border(if (selected) 1.6.dp else 1.dp, border, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .border(if (selected) 5.dp else 1.6.dp, if (selected) TallyColors.NavRed else Color(0xFF8A8A8A), CircleShape),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = label,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) TallyColors.NavRed else TallyColors.TextBody,
            maxLines = 1,
        )
    }
}
