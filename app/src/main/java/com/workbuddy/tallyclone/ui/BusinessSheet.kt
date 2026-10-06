package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.BusinessItem
import com.workbuddy.tallyclone.data.toBengaliDigits
import kotlinx.coroutines.launch

/**
 * মাল্টি ব্যবসা — the bottom sheet behind the home tab's first service tile.
 *
 * Layout follows the reference app: a sheet header carrying the count, a
 * সেটিংস affordance, one row per book with the active one ticked, and a
 * red-outlined "+ নতুন ব্যবসা" at the foot.
 *
 * Everything the sheet shows comes from the server (`GET /api/businesses`), and
 * every action goes back to it — the sheet holds no business state of its own
 * beyond which dialog is open.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BusinessSheet(
    store: AppStore,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    /** Which text dialog is open, if any. */
    var prompt by remember { mutableStateOf<Prompt?>(null) }
    /** The row whose rename/delete menu is open, if any. */
    var managing by remember { mutableStateOf<BusinessItem?>(null) }
    /** Non-null while a write is in flight, so the sheet can't be double-tapped. */
    var busy by remember { mutableStateOf(false) }

    val label = "ব্যবসা সমূহ (${toBengaliDigits(store.businesses.size)}/" +
        "${toBengaliDigits(store.maxBusinesses)})"

    Box(Modifier.fillMaxSize()) {
        // Scrim. Tapping outside the sheet dismisses it, like the reference app.
        Box(
            Modifier
                .fillMaxSize()
                .background(TallyColors.Scrim)
                .clickable(enabled = !busy) { onDismiss() },
        )

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .background(Color.White),
        ) {
            SheetHeader(label = label, onSettings = { managing = store.activeBusiness })
            Hairline()

            Column(
                Modifier
                    .heightIn(max = 330.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                if (store.businesses.isEmpty()) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 28.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("ব্যবসা লোড হচ্ছে…", fontSize = 14.sp, color = TallyColors.TextHint)
                    }
                }
                store.businesses.forEach { business ->
                    BusinessRow(
                        business = business,
                        active = business.id == store.activeBusinessId,
                        enabled = !busy,
                        onClick = {
                            if (busy || business.id == store.activeBusinessId) return@BusinessRow
                            busy = true
                            scope.launch {
                                store.switchBusiness(business.id)
                                busy = false
                                onDismiss()
                            }
                        },
                        onLongClick = { managing = business },
                    )
                    Hairline()
                }
            }

            AddBusinessButton(
                enabled = store.canAddBusiness && !busy,
                atCap = !store.canAddBusiness,
                max = store.maxBusinesses,
                onClick = { prompt = Prompt.Create },
            )

            Spacer(Modifier.navigationBarsPadding())
        }
    }

    // ---- dialogs ----------------------------------------------------------

    if (prompt is Prompt.Create) {
        BusinessTypeSheet(
            onDismiss = { prompt = null },
            onConfirm = { name, category, isPersonal ->
                prompt = null
                busy = true
                scope.launch {
                    val result = store.createBusiness(name, category, isPersonal)
                    busy = false
                    if (result.isSuccess) onDismiss()
                }
            },
        )
    }

    (prompt as? Prompt.Rename)?.let { target ->
        NamePrompt(
            title = "ব্যবসার নাম",
            initial = target.business.name,
            confirmLabel = "সংরক্ষণ",
            onDismiss = { prompt = null },
            onConfirm = { name ->
                prompt = null
                busy = true
                scope.launch {
                    val result = store.renameBusiness(target.business.id, name)
                    busy = false
                    if (result.isSuccess) onDismiss()
                }
            },
        )
    }

    managing?.let { business ->
        ActionSheet(
            title = business.name,
            // The last book cannot be deleted — there would be nothing left for
            // the server to fall back to. Hiding the action is friendlier than
            // letting it fail.
            canDelete = store.businesses.size > 1,
            onRename = {
                managing = null
                prompt = Prompt.Rename(business)
            },
            onDelete = {
                managing = null
                busy = true
                scope.launch {
                    store.deleteBusiness(business.id)
                    busy = false
                }
            },
            onDismiss = { managing = null },
        )
    }
}

/** What a [NamePrompt] is being used for. */
private sealed interface Prompt {
    data object Create : Prompt
    data class Rename(val business: BusinessItem) : Prompt
}

// ---------------------------------------------------------------------------
// Sheet chrome
// ---------------------------------------------------------------------------

@Composable
private fun SheetHeader(label: String, onSettings: () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Spacer(Modifier.height(8.dp))
        Box(
            Modifier
                .align(Alignment.CenterHorizontally)
                .width(36.dp)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color(0xFFD1D5DB)),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 12.dp, top = 10.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
            PillButton(
                label = "সেটিংস",
                background = TallyColors.SoftPill,
                textColor = TallyColors.TextBody,
                icon = TallyIcons.Gear,
                height = 32.dp,
                fontSize = 12.5.sp,
                onClick = onSettings,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BusinessRow(
    business: BusinessItem,
    active: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(64.dp)
            .combinedClickable(
                enabled = enabled,
                onClick = onClick,
                onLongClick = onLongClick,
            )
            .padding(start = 16.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = business.name,
                    fontSize = 15.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
                if (business.isPrimary) {
                    Spacer(Modifier.width(6.dp))
                    PrimaryChip()
                }
            }
            Spacer(Modifier.height(3.dp))
            Text(
                text = business.subtitle,
                fontSize = 12.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(10.dp))
        Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            if (active) {
                Box(
                    Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF108A00)),
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Check, Color.White, 14.dp, strokeWidth = 2.4f)
                }
            } else {
                LineIcon(TallyIcons.ChevronRight, Color(0xFF6B7280), 18.dp, strokeWidth = 2f)
            }
        }
    }
}

/** The `[প্রাইমারি]` chip next to the account's default book. */
@Composable
private fun PrimaryChip() {
    Row(
        Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFFF3F4F6))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "প্রাইমারি",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF4B5563),
            maxLines = 1,
        )
    }
}

/** The red-outlined '+ নতুন ব্যবসা' action at the foot of the sheet. */
@Composable
private fun AddBusinessButton(
    enabled: Boolean,
    atCap: Boolean,
    max: Int,
    onClick: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        val border = if (enabled) Color(0xFFBA1A1A) else TallyColors.FieldBorder
        val text = if (enabled) Color(0xFFBA1A1A) else TallyColors.MutedText
        Row(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(24.dp))
                .border(1.5.dp, border, RoundedCornerShape(24.dp))
                .clickable(enabled = enabled) { onClick() },
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LineIcon(TallyIcons.Plus, text, 16.dp, strokeWidth = 2.2f)
            Spacer(Modifier.width(6.dp))
            Text(
                text = "নতুন ব্যবসা",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = text,
                maxLines = 1,
            )
        }
        if (atCap) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = "সর্বোচ্চ ${toBengaliDigits(max)}টি ব্যবসা যোগ করা যাবে",
                fontSize = 12.sp,
                color = TallyColors.TextHint,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Long-press actions
// ---------------------------------------------------------------------------

@Composable
private fun ActionSheet(
    title: String,
    canDelete: Boolean,
    onRename: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(TallyColors.Scrim)
                .clickable { onDismiss() },
        )
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .background(Color.White),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
            }
            Hairline()
            SheetAction("নাম পরিবর্তন", TallyColors.TextPrimary, onRename)
            Hairline()
            if (canDelete) {
                SheetAction("ব্যবসা মুছে ফেলুন", TallyColors.CtaRed, onDelete)
                Hairline()
            }
            SheetAction("বাতিল", TallyColors.TextSecondary, onDismiss)
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

@Composable
private fun SheetAction(label: String, color: Color, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clickable { onClick() }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(label, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = color, maxLines = 1)
    }
}

// ---------------------------------------------------------------------------
// Text prompt
// ---------------------------------------------------------------------------

@Composable
private fun NamePrompt(
    title: String,
    initial: String,
    confirmLabel: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var value by remember { mutableStateOf(initial) }

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(TallyColors.Scrim)
                .clickable { onDismiss() },
        )
        Column(
            Modifier
                .align(Alignment.Center)
                .padding(horizontal = 24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .padding(16.dp),
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
            )
            Spacer(Modifier.height(14.dp))
            TallyField(
                value = value,
                onValueChange = { value = it },
                placeholder = "ব্যবসার নাম",
            )
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                PillButton(
                    label = "বাতিল",
                    background = TallyColors.SoftPill,
                    textColor = TallyColors.TextBody,
                    onClick = onDismiss,
                )
                Spacer(Modifier.width(8.dp))
                PillButton(
                    label = confirmLabel,
                    background = TallyColors.CtaRed,
                    textColor = Color.White,
                    onClick = { if (value.isNotBlank()) onConfirm(value.trim()) },
                )
            }
        }
    }
}

private data class BusinessCategory(
    val name: String,
    val iconType: String,
)

private val BUSINESS_CATEGORIES = listOf(
    BusinessCategory("মুদি বা জেনারেল স্টোর", "basket"),
    BusinessCategory("ফ্যাশন বা কাপড়ের ব্যবসা", "yarn"),
    BusinessCategory("মোবাইল ব্যাংকিং ও রিচার্জ পয়েন্ট", "mobile_recharge"),
    BusinessCategory("বেকারি ও কনফেকশনারি", "bakery"),
    BusinessCategory("গৃহস্থালি ও ফার্নিচার", "furniture"),
    BusinessCategory("লাইব্রেরি ও স্টেশনারী", "stationery"),
    BusinessCategory("জুতার দোকান", "shoes"),
    BusinessCategory("ডিলার/ডিস্ট্রিবিউটর বা পাইকারি ব্যবসা", "wholesale"),
    BusinessCategory("হার্ডওয়্যার", "hardware"),
    BusinessCategory("ফার্মেসি", "pharmacy"),
    BusinessCategory("কসমেটিকস, বিউটি ও জুয়েলারি", "cosmetics"),
    BusinessCategory("রেস্টুরেন্ট বা মিষ্টির দোকান", "restaurant"),
    BusinessCategory("মোবাইল, কম্পিউটার ও ইলেক্ট্রনিক্স", "electronics"),
    BusinessCategory("কৃষি পণ্য ও উপকরণ", "agriculture"),
)

@Composable
private fun BusinessTypeSheet(
    onDismiss: () -> Unit,
    onConfirm: (name: String, category: String, isPersonal: Boolean) -> Unit,
) {
    var businessName by remember { mutableStateOf("") }
    var isPersonal by remember { mutableStateOf(false) }
    var selectedCategory by remember { mutableStateOf(BUSINESS_CATEGORIES[0].name) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(
                interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                indication = null,
                onClick = onDismiss,
            ),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .background(Color.White)
                .clickable(
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null,
                    onClick = { /* consume click */ },
                ),
        ) {
            // Header: Title + Close Button
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "আপনার ব্যবসার ধরণ কি?",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1F2937),
                    modifier = Modifier.weight(1f),
                )
                Box(
                    Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFF3F4F6))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "✕",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4B5563),
                    )
                }
            }

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
            ) {
                // ব্যক্তিগত হিসাব রাখি toggle row (Screenshot 1 & 2)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LineIcon(TallyIcons.Person, Color(0xFFD97706), 22.dp, strokeWidth = 1.7f)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "ব্যক্তিগত হিসাব রাখি",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF1F2937),
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = isPersonal,
                        onCheckedChange = { isPersonal = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFE11D48),
                            uncheckedThumbColor = Color.White,
                            uncheckedTrackColor = Color(0xFFE5E7EB),
                        ),
                    )
                }

                Spacer(Modifier.height(8.dp))

                // Business Name field
                Text(
                    text = "ব্যবসার নাম",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF4B5563),
                )
                Spacer(Modifier.height(6.dp))
                TallyField(
                    value = businessName,
                    onValueChange = { businessName = it },
                    placeholder = "ব্যবসার নাম লিখুন (ঐচ্ছিক)",
                )

                Spacer(Modifier.height(16.dp))

                // Grid of 14 categories (2 columns)
                val chunked = BUSINESS_CATEGORIES.chunked(2)
                chunked.forEach { rowCategories ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 5.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        rowCategories.forEach { category ->
                            val isSelected = selectedCategory == category.name
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(64.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Color.White else Color(0xFFF9FAFB))
                                    .border(
                                        width = if (isSelected) 1.5.dp else 1.dp,
                                        color = if (isSelected) Color(0xFFBA1A1A) else Color(0xFFE5E7EB),
                                        shape = RoundedCornerShape(8.dp),
                                    )
                                    .clickable { selectedCategory = category.name }
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    CategoryIcon(category.iconType)
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        text = category.name,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = Color(0xFF1F2937),
                                        lineHeight = 16.sp,
                                        maxLines = 2,
                                    )
                                }
                            }
                        }
                        if (rowCategories.size == 1) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
            }

            // Pinned Bottom Button: নিশ্চিত
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .navigationBarsPadding(),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFFBA1A1A))
                        .clickable {
                            val finalName = businessName.trim().ifBlank { selectedCategory }
                            onConfirm(finalName, selectedCategory, isPersonal)
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "নিশ্চিত",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryIcon(type: String) {
    val emoji = when (type) {
        "basket" -> "🧺"
        "yarn" -> "🧶"
        "mobile_recharge" -> "📱"
        "bakery" -> "🥧"
        "furniture" -> "🛋️"
        "stationery" -> "✏️"
        "shoes" -> "👠"
        "wholesale" -> "👔"
        "hardware" -> "🔩"
        "pharmacy" -> "💊"
        "cosmetics" -> "💄"
        "restaurant" -> "🍔"
        "electronics" -> "💻"
        "agriculture" -> "🥕"
        else -> "🏪"
    }
    Text(text = emoji, fontSize = 22.sp)
}
