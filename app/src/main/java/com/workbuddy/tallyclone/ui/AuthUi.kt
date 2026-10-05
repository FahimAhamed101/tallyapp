package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.res.painterResource
import com.workbuddy.tallyclone.R
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared chrome for the two signed-out screens (লগইন / রেজিস্টার).
 *
 * Both screens are one column: a gold brand block at the top, then a white
 * card holding the fields and the primary action — the same visual language the
 * signed-in tabs use, so logging in does not feel like a different app.
 */
@Composable
fun AuthScaffold(
    title: String,
    subtitle: String,
    onBack: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        // --- gold brand block ---------------------------------------------
        Box(Modifier.fillMaxWidth().background(GoldBrush)) {
            Column {
                Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))

                if (onBack != null) {
                    Box(
                        Modifier.size(44.dp).clickable { onBack() },
                        contentAlignment = Alignment.Center,
                    ) {
                        LineIcon(
                            TallyIcons.ChevronLeft,
                            TallyColors.TextPrimary,
                            24.dp,
                            strokeWidth = 2.2f,
                        )
                    }
                } else {
                    Spacer(Modifier.height(28.dp))
                }

                Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 26.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "TallyKhata",
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp)),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "টালিখাতা",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            color = TallyColors.TextPrimary,
                        )
                    }
                    Spacer(Modifier.height(18.dp))
                    Text(
                        text = title,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.TextPrimary,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = subtitle,
                        fontSize = 13.5.sp,
                        color = TallyColors.TextBody,
                        lineHeight = 19.sp,
                    )
                }
            }
        }

        // --- form ----------------------------------------------------------
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
        ) {
            Spacer(Modifier.height(24.dp))
            content()
            Spacer(Modifier.height(24.dp))
        }

        Spacer(Modifier.navigationBarsPadding())
    }
}

/**
 * Rounded field with a leading line-art icon and an optional password reveal.
 * Mirrors [TallyField] so the auth screens match the rest of the app.
 */
@Composable
fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    icon: List<String>? = null,
    prefix: String? = null,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier,
) {
    var revealed by remember { mutableStateOf(false) }

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
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                visualTransformation = if (isPassword && !revealed) {
                    PasswordVisualTransformation()
                } else {
                    VisualTransformation.None
                },
                textStyle = TextStyle(fontSize = 15.sp, color = TallyColors.TextPrimary),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (isPassword) {
            Spacer(Modifier.width(8.dp))
            Box(
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .clickable { revealed = !revealed },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(
                    TallyIcons.Eye,
                    if (revealed) TallyColors.NavRed else TallyColors.TextHint,
                    20.dp,
                    strokeWidth = 1.8f,
                )
            }
        }
    }
}

/** Inline red validation message under a form. */
@Composable
fun AuthError(message: String?) {
    if (message.isNullOrBlank()) return
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFFDE7E7))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(18.dp).clip(CircleShape).background(TallyColors.NavRed),
            contentAlignment = Alignment.Center,
        ) {
            Text("!", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Spacer(Modifier.width(10.dp))
        Text(
            text = message,
            fontSize = 12.5.sp,
            color = Color(0xFF7A1010),
            lineHeight = 17.sp,
            modifier = Modifier.weight(1f),
        )
    }
}

/** Centred "লগইন করুন" / "রেজিস্টার করুন" link at the bottom of each screen. */
@Composable
fun AuthSwitchRow(
    prompt: String,
    action: String,
    onClick: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(top = 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(prompt, fontSize = 13.5.sp, color = TallyColors.TextSecondary)
        Spacer(Modifier.width(6.dp))
        Text(
            text = action,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.NavRed,
            modifier = Modifier.clickable { onClick() },
        )
    }
}
