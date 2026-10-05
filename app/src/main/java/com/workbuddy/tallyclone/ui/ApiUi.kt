package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore

/** Server icon keys -> the hand-authored icon set. */
fun walletIconFor(key: String): List<String> = when (key) {
    "add_money" -> TallyIcons.AddMoney
    "send_money" -> TallyIcons.SendMoney
    "bank_transfer" -> TallyIcons.BankTransfer
    "wallet_transfer" -> TallyIcons.WalletTransfer
    "mobile_recharge" -> TallyIcons.MobileRecharge
    "tally_transfer" -> TallyIcons.TallyTransfer
    "qr_code" -> TallyIcons.Qr
    "bill_payment" -> TallyIcons.BillPayment
    else -> TallyIcons.Document
}

fun menuIconFor(key: String): List<String> = when (key) {
    "note_edit" -> TallyIcons.NoteEdit
    "arrow_out" -> TallyIcons.ArrowOut
    "inbox_doc" -> TallyIcons.InboxDoc
    "document" -> TallyIcons.Document
    "chart" -> TallyIcons.Chart
    "gear" -> TallyIcons.Gear
    else -> TallyIcons.Document
}

/** Amount tone from the API -> the colour the reference app uses. */
fun toneColor(tone: String): Color = when (tone) {
    "pabo" -> TallyColors.PaboRed
    "debo" -> TallyColors.DeboGreen
    else -> TallyColors.TextStrong
}

/** Red strip under the toolbar when a request fails, with a Retry action. */
@Composable
fun ErrorBanner(store: AppStore, onRetry: () -> Unit) {
    val message = store.error ?: return
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFFFDE7E7))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .background(TallyColors.NavRed),
            contentAlignment = Alignment.Center,
        ) {
            Text("!", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Spacer(Modifier.width(10.dp))
        Text(
            text = message,
            fontSize = 12.5.sp,
            color = Color(0xFF7A1010),
            maxLines = 2,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Box(
            Modifier
                .clip(RoundedCornerShape(50))
                .background(TallyColors.NavRed)
                .clickable {
                    store.clearError()
                    onRetry()
                }
                .padding(horizontal = 12.dp, vertical = 5.dp),
        ) {
            Text("আবার চেষ্টা", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

/** Centred spinner used while a screen's first load is in flight. */
@Composable
fun LoadingBox(modifier: Modifier = Modifier, label: String = "লোড হচ্ছে…") {
    Column(
        modifier.fillMaxWidth().padding(vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(28.dp),
            color = TallyColors.NavRed,
            strokeWidth = 3.dp,
        )
        Spacer(Modifier.height(10.dp))
        Text(label, fontSize = 13.sp, color = TallyColors.TextSecondary)
    }
}

/** Empty-state used by lists that legitimately have no rows. */
@Composable
fun EmptyBox(label: String, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxWidth().padding(vertical = 40.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 14.sp, color = TallyColors.TextHint)
    }
}

/** Full-screen overlay shown while the app is doing its very first load. */
@Composable
fun BootOverlay(label: String = "সার্ভার থেকে ডাটা আনা হচ্ছে…") {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.White),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                modifier = Modifier.size(34.dp),
                color = TallyColors.NavRed,
                strokeWidth = 3.dp,
            )
            Spacer(Modifier.height(14.dp))
            Text("টালিখাতা", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TallyColors.TextPrimary)
            Spacer(Modifier.height(4.dp))
            Text(label, fontSize = 12.5.sp, color = TallyColors.TextSecondary)
        }
    }
}
