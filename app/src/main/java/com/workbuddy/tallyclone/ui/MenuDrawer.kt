package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.res.painterResource
import com.workbuddy.tallyclone.R
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.MenuData
import com.workbuddy.tallyclone.data.MenuEntryItem
import com.workbuddy.tallyclone.data.MenuSectionData
import com.workbuddy.tallyclone.data.Profile

/**
 * The মেন্যু tab: a right-hand navigation drawer drawn over the current tab.
 * Section counts come from the API so the menu reflects real data.
 *
 * It takes the two slices it draws rather than the whole [AppStore], so it stays
 * a pure renderer like every other screen — and so a test can hand it a menu and
 * press a row without a backend. That matters here more than usual: the row that
 * opens সেটিংস looked identical whether it was wired or not, so the only way to
 * tell is to press it.
 */
@Composable
fun MenuDrawer(
    menu: MenuData?,
    profile: Profile?,
    onDismiss: () -> Unit,
    onLogout: () -> Unit,
    onItemClick: (MenuEntryItem) -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        // Scrim over the tab underneath.
        Box(
            Modifier
                .fillMaxSize()
                .background(TallyColors.Scrim)
                .clickable { onDismiss() },
        )

        Column(
            Modifier
                .align(Alignment.CenterEnd)
                .fillMaxHeight()
                .fillMaxWidth(0.67f)
                .background(Color.White)
                .clickable(enabled = false) {},
        ) {
            Spacer(Modifier.windowInsetsPadding(WindowInsets.statusBars))
            DrawerHeader(profile)
            GoldRow(profile)

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
            ) {
                if (menu == null) {
                    LoadingBox()
                } else {
                    menu.sections.forEach { section ->
                        SectionLabel(section.title)
                        section.items.forEach { item ->
                            MenuRow(item) { onItemClick(item) }
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            DrawerFooter(menu?.version ?: "")
            LogoutRow(onLogout)
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

// ---------------------------------------------------------------------------

@Composable
private fun DrawerHeader(profile: Profile?) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(78.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(
            photoUrl = profile?.photoUrl?.takeIf { it.isNotBlank() },
            initials = profile?.initials ?: "…",
            size = 46.dp,
            background = TallyColors.MenuAvatarYellow,
            textColor = Color(0xFF6B4E00),
            fontSize = 16.sp,
        )
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = profile?.name ?: "",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = profile?.phone ?: "",
                fontSize = 13.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        LineIcon(TallyIcons.ChevronRight, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.8f)
    }
}

/** Signs this device out and returns to the login screen. */
@Composable
private fun LogoutRow(onLogout: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Hairline()
    }
    Row(
        Modifier
            .fillMaxWidth()
            .height(50.dp)
            .clickable { onLogout() }
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(TallyIcons.Logout, TallyColors.NavRed, 22.dp, strokeWidth = 1.8f)
        Spacer(Modifier.width(16.dp))
        Text(
            text = "লগআউট",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.NavRed,
            maxLines = 1,
        )
    }
}

@Composable
private fun GoldRow(profile: Profile?) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(62.dp)
            .background(TallyColors.MenuGoldRow)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(Color.White),
            contentAlignment = Alignment.Center,
        ) {
            SolidIcon(TallyIcons.Crown, TallyColors.CrownGold, 22.dp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = profile?.goldPlanName ?: "টালিখাতা গোল্ড (ট্রায়াল)",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = profile?.goldTrialLabel ?: "",
                fontSize = 12.5.sp,
                color = TallyColors.TextBody,
                maxLines = 1,
            )
        }
        LineIcon(TallyIcons.ChevronRight, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.8f)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontSize = 13.5.sp,
        fontWeight = FontWeight.Bold,
        color = TallyColors.SectionRed,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun MenuRow(entry: MenuEntryItem, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clickable { onClick() }
            .padding(start = 18.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(menuIconFor(entry.icon), TallyColors.TextBody, 22.dp, strokeWidth = 1.7f)
        Spacer(Modifier.width(16.dp))
        Text(
            text = entry.label,
            fontSize = 15.sp,
            color = TallyColors.TextPrimary,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        if (entry.count > 0) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(TallyColors.SoftPill)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    text = com.workbuddy.tallyclone.data.toBengaliDigits(entry.count),
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextSecondary,
                )
            }
        }
    }
}

@Composable
private fun DrawerFooter(version: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "TallyKhata",
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp)),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = "টালিখাতা",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.CtaRed,
        )
        Spacer(Modifier.weight(1f))
        Text(
            text = version,
            fontSize = 11.5.sp,
            color = TallyColors.TextSecondary,
            maxLines = 1,
        )
    }
}
