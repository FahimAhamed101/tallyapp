package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.WalletServiceItem
import kotlinx.coroutines.launch

/**
 * ওয়ালেট tab - a muted service grid, a hero illustration and the benefit
 * bullets above the "open a Talipay account" call to action. The service list
 * and benefits come from the API.
 */
@Composable
fun WalletScreen(store: AppStore, onTabSelected: (Int) -> Unit) {
    val scope = rememberCoroutineScope()
    val wallet = store.wallet

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(GoldBrush),
        ) {
            Column {
                GoldHeader(
                    businessName = store.profile?.name ?: "…",
                    inboxBadge = store.profile?.inboxUnread ?: 0,
                )
                WalletServicesCard(wallet?.services ?: emptyList())
            }
        }

        ErrorBanner(store) { scope.launch { store.refreshWallet() } }

        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(Modifier.height(18.dp))
            HeroIllustration()
            Spacer(Modifier.height(14.dp))

            when {
                store.loading && wallet == null -> LoadingBox()
                wallet == null -> EmptyBox("ওয়ালেট ডাটা পাওয়া যায়নি")
                else -> {
                    wallet.benefits.forEach { benefit ->
                        BenefitRow(benefit)
                        Spacer(Modifier.height(8.dp))
                    }
                    Spacer(Modifier.height(18.dp))

                    val label = if (wallet.accountOpened) "টালিপে একাউন্ট খোলা হয়েছে" else "টালিপে একাউন্ট খুলুন"
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp)
                            .height(48.dp)
                            .clip(RoundedCornerShape(50))
                            .background(if (wallet.accountOpened) TallyColors.DeboGreen else TallyColors.CtaRed)
                            .clickable(enabled = !wallet.accountOpened) {
                                scope.launch { store.openWalletAccount() }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = label,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }

                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = "ব্যালেন্স: ৳ ${wallet.balanceDisplay}",
                        fontSize = 12.5.sp,
                        color = TallyColors.TextSecondary,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
        }

        BottomNav(selected = TAB_WALLET, onSelect = onTabSelected)
    }
}

// ---------------------------------------------------------------------------
// Muted service grid
// ---------------------------------------------------------------------------

@Composable
private fun WalletServicesCard(services: List<WalletServiceItem>) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
            .background(TallyColors.CardCream)
            .padding(start = 8.dp, end = 8.dp, top = 16.dp, bottom = 14.dp),
    ) {
        if (services.isEmpty()) {
            LoadingBox(label = "")
            return@Column
        }
        services.chunked(4).forEach { rowItems ->
            Row(Modifier.fillMaxWidth()) {
                rowItems.forEach { service ->
                    WalletServiceCell(service, Modifier.weight(1f))
                }
                // keep the last row aligned to 4 columns
                repeat(4 - rowItems.size) {
                    Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun WalletServiceCell(service: WalletServiceItem, modifier: Modifier) {
    val tint = if (service.enabled) TallyColors.GlyphGreen else TallyColors.MutedIcon
    val labelTint = if (service.enabled) TallyColors.TextPrimary else TallyColors.MutedText

    Column(
        modifier = modifier.padding(top = 8.dp, bottom = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        LineIcon(walletIconFor(service.icon), tint, 28.dp, strokeWidth = 1.6f)
        Spacer(Modifier.height(5.dp))
        Box(Modifier.height(20.dp), contentAlignment = Alignment.Center) {
            Text(
                text = service.label,
                fontSize = 11.5.sp,
                color = labelTint,
                maxLines = 1,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Hero illustration (vector stand-in for the reference raster)
// ---------------------------------------------------------------------------

@Composable
private fun HeroIllustration() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(150.dp),
        contentAlignment = Alignment.Center,
    ) {
        // TallyKhata red card, tilted behind the phone
        Box(
            Modifier
                .offset(x = (-52).dp, y = 6.dp)
                .size(width = 124.dp, height = 80.dp)
                .graphicsLayer { rotationZ = -8f }
                .clip(RoundedCornerShape(8.dp))
                .background(TallyColors.WalletHeroRed),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "টালিখাতা",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.height(3.dp))
                Text("TallyKhata", fontSize = 8.sp, color = Color(0xFFFFD9D6))
            }
        }

        // Phone outline
        Box(
            Modifier
                .offset(x = 44.dp)
                .size(width = 88.dp, height = 132.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .border(3.dp, Color(0xFFD8D8D8), RoundedCornerShape(16.dp)),
        )

        // Green confirmation badge overlapping the phone
        Box(
            Modifier
                .offset(x = 20.dp, y = 30.dp)
                .size(38.dp)
                .clip(CircleShape)
                .background(TallyColors.WalletHeroCheck),
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(TallyIcons.Check, Color.White, 22.dp, strokeWidth = 2.8f)
        }
    }
}

// ---------------------------------------------------------------------------
// Benefit bullets
// ---------------------------------------------------------------------------

@Composable
private fun BenefitRow(text: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 28.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .padding(top = 2.dp)
                .size(17.dp)
                .clip(CircleShape)
                .border(1.6.dp, Color(0xFF1B5E20), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(TallyIcons.Check, Color(0xFF1B5E20), 11.dp, strokeWidth = 2.4f)
        }
        Spacer(Modifier.width(10.dp))
        Text(
            text = text,
            fontSize = 13.5.sp,
            color = TallyColors.TextPrimary,
            lineHeight = 19.sp,
            modifier = Modifier.weight(1f),
        )
    }
}
