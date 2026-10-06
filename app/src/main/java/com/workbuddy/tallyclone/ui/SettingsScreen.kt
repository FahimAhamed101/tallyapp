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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppSettings
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.toBengaliDigits

/**
 * সেটিংস — reached from the drawer's সেটিংস row.
 *
 * Three screens live here, mirroring the reference screen's three sections:
 *
 *   [SettingsScreen]      সাধারণ সেটিংস / প্রোফাইল সেটিংস / অ্যাপ সিকিউরিটি
 *   [PinScreen]           অ্যাপ সিকিউরিটি → PIN সেট করুন / পরিবর্তন / সরান
 *   [PhoneChangeScreen]   প্রোফাইল সেটিংস → মোবাইল নম্বর পরিবর্তন
 *
 * All three are pure renderers over [AppSettings]: the labels that depend on
 * state (the decimal example, the PIN row's wording, the current number) are
 * rendered from the envelope the server sent, not composed here. Only the
 * static section headings are local. Every write is issued from `AppRoot`, so a
 * render test never touches the network.
 *
 * The reference screenshot shows মোবাইল নম্বর পরিবর্তন greyed out with
 * "অনুগ্রহ করে আপনার ইন্টারনেট সংযোগটি চালু করুন।" — that is a *connectivity*
 * message from a device that was offline, not a property of the feature. This
 * build is online, so the row is live and the change-number flow actually works.
 */

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/** Back chevron + title, matching the other pushed screens. */
@Composable
private fun SettingsToolbar(title: String, onBack: () -> Unit) {
    Column {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
        Row(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(start = 8.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                LineIcon(TallyIcons.ChevronLeft, TallyColors.TextPrimary, 24.dp, strokeWidth = 2.2f)
            }
            Spacer(Modifier.width(6.dp))
            Text(
                text = title,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
        }
        Hairline()
    }
}

/** The clean section title matching screenshot — সাধারণ সেটিংস, প্রোফাইল সেটিংস, … */
@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 13.sp,
        fontWeight = FontWeight.Normal,
        color = Color(0xFF4B5563),
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 6.dp),
    )
}

/** Section divider band */
@Composable
private fun SectionBand() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(8.dp)
            .background(Color(0xFFF3F4F6)),
    )
}

/**
 * A settings row whose control is a switch.
 *
 * The *row* owns the toggle rather than the switch: `Modifier.toggleable` puts
 * the toggle semantics on the row and merges its children, so the whole line is
 * the hit target and the state is readable from the label's node. The [Switch]
 * is then a pure indicator (`onCheckedChange = null`), which is why tapping the
 * label and tapping the switch cannot disagree about what happened.
 */
@Composable
private fun ToggleRow(
    label: String,
    subtitle: String,
    value: Boolean,
    onValueChange: (Boolean) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .toggleable(value = value, onValueChange = onValueChange, role = Role.Switch)
            .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = subtitle,
                fontSize = 12.5.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = value,
            // The row above already handles the tap; see the note on the modifier.
            onCheckedChange = null,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Color(0xFF108A00),
                checkedBorderColor = Color(0xFF108A00),
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Color(0xFFBDBDBD),
                uncheckedBorderColor = Color(0xFFBDBDBD),
            ),
        )
    }
}

/** A row that pushes another screen: leading glyph, two lines, a chevron. */
@Composable
private fun NavRow(
    icon: List<String>,
    label: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(start = 16.dp, end = 12.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(icon, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.8f)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            if (subtitle.isNotBlank()) {
                Spacer(Modifier.height(3.dp))
                Text(
                    text = subtitle,
                    fontSize = 12.5.sp,
                    color = TallyColors.TextSecondary,
                    maxLines = 1,
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        LineIcon(TallyIcons.ChevronRight, Color(0xFF6B7280), 18.dp, strokeWidth = 1.9f)
    }
}

// ---------------------------------------------------------------------------
// সেটিংস
// ---------------------------------------------------------------------------

@Composable
fun SettingsScreen(
    store: AppStore,
    settings: AppSettings?,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onToggleDecimal: (Boolean) -> Unit,
    onToggleSound: (Boolean) -> Unit,
    onToggleVoice: (Boolean) -> Unit = {},
    onOpenPhoneChange: () -> Unit,
    onOpenPin: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        SettingsToolbar(title = "সেটিংস", onBack = onBack)

        ErrorBanner(store, onRetry)

        if (settings == null) {
            LoadingBox(Modifier.fillMaxSize())
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                // ---- সাধারণ সেটিংস --------------------------------------
                SectionHeader("সাধারণ সেটিংস")
                ToggleRow(
                    label = "টাকার অঙ্কে দশমিক",
                    subtitle = settings.decimalExample,
                    value = settings.decimalAmount,
                    onValueChange = onToggleDecimal,
                )
                Hairline()
                ToggleRow(
                    label = "নোটিফিকেশন সাউন্ড",
                    subtitle = settings.notificationSubtitle,
                    value = settings.notificationSound,
                    onValueChange = onToggleSound,
                )
                Hairline()
                ToggleRow(
                    label = "ভয়েস নোটিফিকেশন",
                    subtitle = "ভয়েসের মাধ্যমে পেমেন্ট এলার্ট",
                    value = settings.voiceNotification,
                    onValueChange = onToggleVoice,
                )

                SectionBand()

                // ---- প্রোফাইল সেটিংস ------------------------------------
                SectionHeader("প্রোফাইল সেটিংস")
                NavRow(
                    icon = TallyIcons.Phone,
                    label = "মোবাইল নম্বর পরিবর্তন",
                    subtitle = "",
                    onClick = onOpenPhoneChange,
                )

                SectionBand()

                // ---- অ্যাপ সিকিউরিটি ------------------------------------
                SectionHeader("অ্যাপ সিকিউরিটি")
                NavRow(
                    icon = TallyIcons.Key,
                    label = settings.pinLabel,
                    subtitle = "",
                    onClick = onOpenPin,
                )

                Spacer(Modifier.height(24.dp))
                Spacer(Modifier.navigationBarsPadding())
            }
        }
    }
}

// ---------------------------------------------------------------------------
// অ্যাপ সিকিউরিটি — PIN সেট / পরিবর্তন / সরান
// ---------------------------------------------------------------------------

/**
 * Validates locally *and* lets the server validate again — the local check only
 * exists so the button can be disabled with a reason on screen; the rule itself
 * comes from [AppSettings.pinMin] / [AppSettings.pinMax], so it cannot drift
 * from the validator that actually rejects a bad PIN.
 */
@Composable
fun PinScreen(
    settings: AppSettings?,
    onBack: () -> Unit,
    onSave: (String) -> Unit,
    onClear: () -> Unit,
) {
    val min = settings?.pinMin ?: 4
    val max = settings?.pinMax ?: 6

    var pin by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    // Bengali digits are accepted and sent through untouched: the server
    // normalises them, exactly as it does for money and phone numbers. `isDigit`
    // is already true for ০-৯, so one predicate covers both keyboards.
    val digitsOnly: (String) -> String = { raw -> raw.filter { it.isDigit() }.take(max) }

    val tooShort = pin.length < min
    val mismatch = confirm.isNotEmpty() && confirm != pin
    val canSubmit = pin.length in min..max && confirm == pin

    val hint = "PIN হতে হবে ${toBengaliDigits(min)} থেকে ${toBengaliDigits(max)} সংখ্যার"

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        SettingsToolbar(title = settings?.pinLabel ?: "PIN সেট করুন", onBack = onBack)

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(18.dp))
            Text(
                text = hint,
                fontSize = 13.sp,
                color = TallyColors.TextSecondary,
            )
            Spacer(Modifier.height(14.dp))

            TallyField(
                value = pin,
                onValueChange = { pin = digitsOnly(it) },
                placeholder = "নতুন PIN",
                icon = TallyIcons.Lock,
            )
            Spacer(Modifier.height(12.dp))
            TallyField(
                value = confirm,
                onValueChange = { confirm = digitsOnly(it) },
                placeholder = "PIN আবার লিখুন",
                icon = TallyIcons.Lock,
            )

            if (tooShort && pin.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                FieldError(hint)
            }
            if (mismatch) {
                Spacer(Modifier.height(8.dp))
                FieldError("দুইবার লেখা PIN মিলছে না")
            }

            Spacer(Modifier.height(20.dp))
            ConfirmButton(
                label = if (settings?.pinSet == true) "PIN পরিবর্তন করুন" else "PIN সেট করুন",
                enabled = canSubmit,
                onClick = { onSave(pin) },
            )

            // Only offered once there is something to remove — an action that
            // cannot do anything is exactly the kind of dead control this screen
            // was built to replace.
            if (settings?.pinSet == true) {
                Spacer(Modifier.height(12.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clickable { onClear() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "PIN সরান",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.NavRed,
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

/** Red helper line under a field. */
@Composable
private fun FieldError(message: String) {
    Text(
        text = message,
        fontSize = 12.5.sp,
        color = TallyColors.NavRed,
    )
}

// ---------------------------------------------------------------------------
// প্রোফাইল সেটিংস — মোবাইল নম্বর পরিবর্তন
// ---------------------------------------------------------------------------

/**
 * The number is the login credential, so the screen shows the current one and
 * says plainly that it is what you sign in with. The real validation — a
 * canonical `+8801…` form, and a refusal when another account already owns the
 * number — happens on the server, because that is the only place that can see
 * the other accounts.
 */
@Composable
fun PhoneChangeScreen(
    currentPhone: String,
    onBack: () -> Unit,
    onSave: (String) -> Unit,
) {
    var phone by remember { mutableStateOf("") }

    // A Bangladeshi mobile number is 11 digits with the trunk 0 (017…), or the
    // same 10 digits with the country code. The check here only decides whether
    // the button is tappable; the real normalisation and the "this number
    // belongs to someone else" refusal both happen on the server, because that
    // is the only place that can see the other accounts.
    val digits = phone.count { it.isDigit() }
    val canSubmit = digits >= 10

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        SettingsToolbar(title = "মোবাইল নম্বর পরিবর্তন", onBack = onBack)

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(18.dp))
            Text(
                text = "বর্তমান নম্বর",
                fontSize = 12.5.sp,
                color = TallyColors.TextSecondary,
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = currentPhone.ifBlank { "—" },
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
            )
            Spacer(Modifier.height(18.dp))

            TallyField(
                value = phone,
                onValueChange = { phone = it.take(20) },
                placeholder = "নতুন মোবাইল নম্বর",
                icon = TallyIcons.Phone,
            )

            Spacer(Modifier.height(10.dp))
            Text(
                text = "০১৭ দিয়ে শুরু করে ১১ সংখ্যার নম্বর দিন। এই নম্বর দিয়েই " +
                    "পরবর্তীতে লগইন করবেন।",
                fontSize = 12.5.sp,
                color = TallyColors.TextSecondary,
            )

            Spacer(Modifier.height(20.dp))
            ConfirmButton(
                label = "নম্বর পরিবর্তন করুন",
                enabled = canSubmit,
                onClick = { onSave(phone) },
            )

            Spacer(Modifier.height(24.dp))
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}
