package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.StockDetail
import com.workbuddy.tallyclone.data.StockItem
import com.workbuddy.tallyclone.data.StockMovementItem
import com.workbuddy.tallyclone.data.StockSummary
import com.workbuddy.tallyclone.data.toBengaliDateShort
import com.workbuddy.tallyclone.data.toBengaliDigits
import kotlinx.coroutines.launch
import java.util.Date

/**
 * স্টক হিসাব — the product list, the create/edit form, and the item detail with
 * its স্টক ইন / স্টক আউট history.
 *
 * All three are pure renderers: every number on screen comes from
 * [AppStore.stock] / [StockDetail], which in turn come from the server. Nothing
 * here adds quantities up. `quantity = openingStock + in − out` is computed
 * server-side from the movement log, exactly as `Customer` balances are, so the
 * app cannot drift out of step with another device's copy of the book.
 */

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/**
 * Back chevron + title + an optional trailing pencil, as the other form screens
 * use. The trailing slot is a plain callback rather than a `@Composable` lambda
 * so the call sites stay free of nested composable-lambda inference.
 */
@Composable
private fun ScreenToolbar(
    title: String,
    subtitle: String? = null,
    showHelp: Boolean = false,
    onBack: () -> Unit,
    onEdit: (() -> Unit)? = null,
) {
    Column {
        Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
        Row(
            Modifier
                .fillMaxWidth()
                .height(60.dp)
                .padding(start = 8.dp, end = 14.dp),
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
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        fontSize = 13.sp,
                        color = Color(0xFF6B7280),
                        maxLines = 1,
                    )
                }
            }
            if (showHelp) {
                HelpChip()
            }
            if (onEdit != null) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clickable { onEdit() },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Pencil, TallyColors.TextPrimary, 20.dp, strokeWidth = 1.8f)
                }
            }
        }
        Hairline()
    }
}

/** The "স্টক কম" badge. Rendered only for items that actually are low. */
@Composable
private fun LowStockChip(label: String) {
    Row(
        Modifier
            .height(19.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(TallyColors.RowRedCircle)
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.RowRedIcon,
            maxLines = 1,
        )
    }
}

/** 3 Isometric cardboard boxes illustration matching screenshot media_1791308504963.png */
@Composable
private fun StockBoxesIllustration() {
    Box(
        Modifier.size(160.dp),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f

            // 1. Soft background circle
            drawCircle(
                color = Color(0xFFF3F4F6),
                radius = 68.dp.toPx(),
                center = Offset(cx, cy),
            )

            // 2. Ambient floating soft dots
            drawCircle(
                color = Color(0xFFE5E7EB),
                radius = 4.dp.toPx(),
                center = Offset(cx - 58.dp.toPx(), cy - 14.dp.toPx()),
            )
            drawCircle(
                color = Color(0xFFE5E7EB),
                radius = 6.dp.toPx(),
                center = Offset(cx - 52.dp.toPx(), cy + 28.dp.toPx()),
            )
            drawCircle(
                color = Color(0xFFE5E7EB),
                radius = 4.dp.toPx(),
                center = Offset(cx + 62.dp.toPx(), cy - 16.dp.toPx()),
            )
            drawCircle(
                color = Color(0xFFE5E7EB),
                radius = 5.dp.toPx(),
                center = Offset(cx + 54.dp.toPx(), cy + 18.dp.toPx()),
            )

            // 3. Helper to draw an isometric cardboard cube
            fun drawIsometricBox(boxCx: Float, boxCy: Float) {
                val rx = 21.dp.toPx()
                val ry = 11.5.dp.toPx()
                val sh = 25.dp.toPx()

                // Top diamond face
                val topPath = Path().apply {
                    moveTo(boxCx, boxCy - ry)
                    lineTo(boxCx + rx, boxCy)
                    lineTo(boxCx, boxCy + ry)
                    lineTo(boxCx - rx, boxCy)
                    close()
                }
                drawPath(topPath, color = Color(0xFFF9FAFB))

                // Tape seam line across top face
                val tapePath = Path().apply {
                    val tw = 3.2.dp.toPx()
                    moveTo(boxCx - tw, boxCy - ry)
                    lineTo(boxCx + tw, boxCy - ry)
                    lineTo(boxCx + tw, boxCy + ry)
                    lineTo(boxCx - tw, boxCy + ry)
                    close()
                }
                drawPath(tapePath, color = Color(0xFFE2E8F0))

                // Left shaded face
                val leftPath = Path().apply {
                    moveTo(boxCx - rx, boxCy)
                    lineTo(boxCx, boxCy + ry)
                    lineTo(boxCx, boxCy + ry + sh)
                    lineTo(boxCx - rx, boxCy + sh)
                    close()
                }
                drawPath(leftPath, color = Color(0xFFE2E8F0))

                // Right shaded face
                val rightPath = Path().apply {
                    moveTo(boxCx, boxCy + ry)
                    lineTo(boxCx + rx, boxCy)
                    lineTo(boxCx + rx, boxCy + sh)
                    lineTo(boxCx, boxCy + ry + sh)
                    close()
                }
                drawPath(rightPath, color = Color(0xFFB0B7C3))

                // Center vertical crease
                drawLine(
                    color = Color(0xFFCBD5E1),
                    start = Offset(boxCx, boxCy + ry),
                    end = Offset(boxCx, boxCy + ry + sh),
                    strokeWidth = 1.dp.toPx(),
                )
            }

            // Draw pyramid: top center first (in background), then bottom-left & bottom-right in front
            drawIsometricBox(cx, cy - 18.dp.toPx())
            drawIsometricBox(cx - 20.dp.toPx(), cy + 8.dp.toPx())
            drawIsometricBox(cx + 20.dp.toPx(), cy + 8.dp.toPx())
        }
    }
}

// ---------------------------------------------------------------------------
// স্টক হিসাব — the list
// ---------------------------------------------------------------------------

@Composable
fun StockListScreen(
    store: AppStore,
    onBack: () -> Unit,
    onOpenItem: (String) -> Unit,
    onAddItem: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        ScreenToolbar(
            title = "স্টক হিসাব",
            subtitle = store.toolbarName,
            showHelp = true,
            onBack = onBack,
        )

        ErrorBanner(store) { scope.launch { store.refreshStock() } }

        if (store.stock.isNotEmpty()) {
            StockSummaryCard(store.stockSummary)
        }

        Box(Modifier.weight(1f)) {
            when {
                store.loading && store.stock.isEmpty() ->
                    LoadingBox(Modifier.fillMaxSize())

                store.stock.isEmpty() -> Column(
                    Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    StockBoxesIllustration()
                    Spacer(Modifier.height(24.dp))
                    Text(
                        text = "প্রোডাক্ট যোগ করে স্টকের হিসাব রাখুন।",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Normal,
                        color = Color(0xFF1F2937),
                    )
                    Spacer(Modifier.height(48.dp))
                }

                else -> Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                ) {
                    store.stock.forEach { item ->
                        StockRow(item = item, onClick = { onOpenItem(item.id) })
                        Hairline()
                    }
                    Spacer(Modifier.height(84.dp))
                }
            }

            AddItemButton(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .navigationBarsPadding()
                    .padding(end = 16.dp, bottom = 24.dp),
                onClick = onAddItem,
            )
        }
    }
}

/** The header card: how many products, what the shelf is worth, what is low. */
@Composable
private fun StockSummaryCard(summary: StockSummary?) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(TallyColors.CardCream)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                // Before the first response lands there is no summary, so the
                // card falls back to a zeroed label rather than vanishing.
                text = summary?.countLabel ?: "পণ্য ০টি",
                fontSize = 13.sp,
                color = TallyColors.TextBody,
                maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
            val low = summary?.lowStockLabel.orEmpty()
            if (low.isNotBlank()) LowStockChip(low)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = summary?.costValueLabel ?: "স্টকের মূল্য ৳০.০০",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.TextPrimary,
            maxLines = 1,
        )
        val sale = summary?.saleValueLabel.orEmpty()
        if (sale.isNotBlank()) {
            Spacer(Modifier.height(3.dp))
            Text(text = sale, fontSize = 12.5.sp, color = TallyColors.TextSecondary, maxLines = 1)
        }
    }
}

@Composable
private fun StockRow(item: StockItem, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(74.dp)
            .clickable { onClick() }
            .padding(start = 14.dp, end = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.name,
                    fontSize = 15.sp,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
                if (item.lowStock) {
                    Spacer(Modifier.width(6.dp))
                    LowStockChip(item.lowStockLabel.ifBlank { "স্টক কম" })
                }
            }
            Spacer(Modifier.height(3.dp))
            Text(
                text = item.quantityLabel,
                fontSize = 13.sp,
                color = TallyColors.TextBody,
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = item.priceLabel,
                fontSize = 11.5.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
        Spacer(Modifier.width(8.dp))
        Text(
            text = item.valueLabel,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = TallyColors.TextPrimary,
            maxLines = 1,
        )
        Spacer(Modifier.width(6.dp))
        LineIcon(TallyIcons.ChevronRight, TallyColors.TextPrimary, 20.dp, strokeWidth = 1.8f)
    }
}

@Composable
private fun AddItemButton(modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .height(48.dp)
            .shadow(4.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFFBA1A1A))
            .clickable { onClick() }
            .padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(TallyIcons.Plus, Color.White, 18.dp, strokeWidth = 2.4f)
        Spacer(Modifier.width(6.dp))
        Text(
            text = "নতুন প্রোডাক্ট",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 1,
        )
    }
}

// ---------------------------------------------------------------------------
// নতুন প্রোডাক্ট / প্রোডাক্ট সম্পাদনা — the form
// ---------------------------------------------------------------------------

/** 120.0 -> "120", 2.5 -> "2.5", 0 -> "" (so the field shows its placeholder). */
private fun numText(value: Double?): String {
    val v = value ?: return ""
    if (v == 0.0) return ""
    return if (v % 1.0 == 0.0) v.toLong().toString() else v.toString()
}

@Composable
fun StockFormScreen(
    store: AppStore,
    item: StockItem?,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val editing = item != null

    var name by remember { mutableStateOf(item?.name.orEmpty()) }
    var unit by remember { mutableStateOf(item?.unit.orEmpty()) }
    var showUnitSheet by remember { mutableStateOf(false) }
    var purchase by remember { mutableStateOf(numText(item?.purchasePrice)) }
    var sale by remember { mutableStateOf(numText(item?.salePrice)) }
    var opening by remember { mutableStateOf(numText(item?.openingStock)) }
    var threshold by remember { mutableStateOf(numText(item?.lowStockThreshold)) }
    var note by remember { mutableStateOf(item?.note.orEmpty()) }

    var submitting by remember { mutableStateOf(false) }
    val canSubmit = name.isNotBlank() && !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        scope.launch {
            val result = if (editing) {
                store.updateStockItem(
                    id = item!!.id,
                    name = name,
                    unit = unit.ifBlank { "পিস" },
                    purchasePrice = purchase,
                    salePrice = sale,
                    openingStock = opening,
                    lowStockThreshold = threshold,
                    note = note,
                )
            } else {
                store.addStockItem(
                    name = name,
                    unit = unit.ifBlank { "পিস" },
                    purchasePrice = purchase,
                    salePrice = sale,
                    openingStock = opening,
                    lowStockThreshold = threshold,
                    note = note,
                )
            }
            submitting = false
            if (result.isSuccess) onBack()
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .background(TallyColors.PageWhite),
        ) {
            ScreenToolbar(
                title = if (editing) "প্রোডাক্ট সম্পাদনা" else "নতুন প্রোডাক্ট",
                onBack = onBack,
            )

            ErrorBanner(store) { submit() }

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
            ) {
                Spacer(Modifier.height(16.dp))

                // Field 1: প্রোডাক্ট এর নাম (matching media_1791308486942.png)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFD1D5DB), RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LineIcon(TallyIcons.StoreFront, Color(0xFF4B5563), 22.dp, strokeWidth = 1.8f)
                    Spacer(Modifier.width(12.dp))
                    Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                        if (name.isEmpty()) {
                            Text("প্রোডাক্ট এর নাম", fontSize = 15.sp, color = Color(0xFF9CA3AF))
                        }
                        androidx.compose.foundation.text.BasicTextField(
                            value = name,
                            onValueChange = { name = it },
                            singleLine = true,
                            textStyle = androidx.compose.ui.text.TextStyle(
                                fontSize = 15.sp,
                                color = TallyColors.TextPrimary,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                // Field 2: প্রোডাক্ট এর ইউনিট (matching media_1791308486942.png)
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                ) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White)
                            .border(
                                width = 1.5.dp,
                                color = Color(0xFFBA1A1A),
                                shape = RoundedCornerShape(8.dp),
                            )
                            .clickable {
                                focusManager.clearFocus()
                                keyboardController?.hide()
                                showUnitSheet = true
                            }
                            .padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LineIcon(TallyIcons.InventoryBox, Color(0xFF4B5563), 22.dp, strokeWidth = 1.8f)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = unit,
                            fontSize = 15.sp,
                            color = TallyColors.TextPrimary,
                            modifier = Modifier.weight(1f),
                        )
                        LineIcon(TallyIcons.ChevronDown, Color(0xFF1F2937), 18.dp, strokeWidth = 2.2f)
                    }

                    // Notched floating red label
                    Box(
                        Modifier
                            .offset(x = 12.dp, y = (-8).dp)
                            .background(Color.White)
                            .padding(horizontal = 4.dp),
                    ) {
                        Text(
                            text = "প্রোডাক্ট এর ইউনিট",
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFFBA1A1A),
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))
            TallyField(
                value = purchase,
                onValueChange = { purchase = it },
                placeholder = "ক্রয় মূল্য",
                prefix = "৳",
            )
            Spacer(Modifier.height(14.dp))
            TallyField(
                value = sale,
                onValueChange = { sale = it },
                placeholder = "বিক্রয় মূল্য",
                prefix = "৳",
            )

            Spacer(Modifier.height(14.dp))
            TallyField(
                value = opening,
                onValueChange = { opening = it },
                placeholder = "প্রারম্ভিক স্টক",
                icon = TallyIcons.Chart,
            )
            Spacer(Modifier.height(14.dp))
            TallyField(
                value = threshold,
                onValueChange = { threshold = it },
                placeholder = "স্টক কম হলে সতর্ক করুন",
                icon = TallyIcons.Bell,
            )

            Spacer(Modifier.height(14.dp))
            TallyField(
                value = note,
                onValueChange = { note = it },
                placeholder = "বিবরণ",
                icon = TallyIcons.NoteEdit,
            )

            // The threshold is the one field whose meaning is not obvious from
            // its name, and getting it wrong is silent — so it is spelled out.
            Spacer(Modifier.height(10.dp))
            Text(
                text = "সতর্কতার সংখ্যা শূন্য রাখলে স্টক কম হলেও দেখানো হবে না।",
                fontSize = 12.sp,
                color = TallyColors.TextHint,
                lineHeight = 17.sp,
            )

            val message = store.error
            if (!message.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = message,
                    fontSize = 12.5.sp,
                    color = TallyColors.NavRed,
                    lineHeight = 17.sp,
                )
            }

            Spacer(Modifier.height(20.dp))
        }

        ConfirmButton(
            label = if (submitting) "সংরক্ষণ হচ্ছে…" else "নিশ্চিত",
            enabled = canSubmit,
            modifier = Modifier.padding(horizontal = 16.dp),
            onClick = { submit() },
        )
        Spacer(Modifier.height(16.dp))
        Spacer(Modifier.navigationBarsPadding())
    }

    if (showUnitSheet) {
        UnitSelectionBottomSheet(
            onSelect = {
                unit = it
                showUnitSheet = false
            },
            onDismiss = { showUnitSheet = false },
        )
    }
    }
}

@Composable
private fun UnitSelectionBottomSheet(
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    androidx.compose.runtime.LaunchedEffect(Unit) {
        keyboardController?.hide()
    }

    val units = listOf(
        "কেজি",
        "পিস",
        "লিটার",
        "টি",
        "ডজন",
        "বস্তা",
        "সেট",
        "গজ",
    )

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
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .background(Color.White)
                .clickable(
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null,
                    onClick = { /* consume click */ },
                )
                .padding(top = 12.dp, bottom = 8.dp)
                .navigationBarsPadding(),
        ) {
            // Drag handle
            Box(
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFFD1D5DB)),
            )

            Spacer(Modifier.height(14.dp))

            Text(
                text = "প্রোডাক্ট এর ইউনিট সিলেক্ট করি",
                fontSize = 17.5.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1F2937),
                modifier = Modifier.padding(horizontal = 20.dp),
            )

            Spacer(Modifier.height(12.dp))

            units.forEach { item ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(item) }
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = item,
                        fontSize = 16.sp,
                        color = Color(0xFF1F2937),
                        modifier = Modifier.weight(1f),
                    )
                    LineIcon(
                        paths = TallyIcons.ChevronRight,
                        color = Color(0xFF1F2937),
                        size = 18.dp,
                        strokeWidth = 2.2f,
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// পণ্যের বিবরণ — one item and its movements
// ---------------------------------------------------------------------------

@Composable
fun StockDetailScreen(
    store: AppStore,
    detail: StockDetail?,
    loading: Boolean,
    onBack: () -> Unit,
    onEdit: (StockItem) -> Unit,
    onReload: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val item = detail?.item

    /** Which movement sheet is open, if any. */
    var movement by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .background(TallyColors.PageWhite),
    ) {
        ScreenToolbar(
            title = item?.name ?: "পণ্যের বিবরণ",
            onBack = onBack,
            onEdit = item?.let { current -> { onEdit(current) } },
        )

        ErrorBanner(store) { onReload() }

        Box(Modifier.weight(1f)) {
            val loaded = detail
            when {
                loaded == null && loading -> LoadingBox(Modifier.fillMaxSize())

                loaded == null -> EmptyBox(
                    label = "পণ্যটি পাওয়া যায়নি",
                    modifier = Modifier.fillMaxSize(),
                )

                else -> Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                ) {
                    ItemHeader(loaded.item)

                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                    ) {
                        PillButton(
                            label = "স্টক ইন",
                            background = TallyColors.RowGreenCircle,
                            textColor = TallyColors.ZeroGreen,
                            icon = TallyIcons.HandReceive,
                            iconColor = TallyColors.ZeroGreen,
                            height = 44.dp,
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f),
                            onClick = { movement = "in" },
                        )
                        Spacer(Modifier.width(10.dp))
                        PillButton(
                            label = "স্টক আউট",
                            background = TallyColors.RowRedCircle,
                            textColor = TallyColors.RowRedIcon,
                            icon = TallyIcons.HandGive,
                            iconColor = TallyColors.RowRedIcon,
                            height = 44.dp,
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f),
                            onClick = { movement = "out" },
                        )
                    }

                    Spacer(Modifier.height(18.dp))
                    Text(
                        text = "মুভমেন্ট",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.TextPrimary,
                        modifier = Modifier.padding(start = 16.dp, bottom = 6.dp),
                    )
                    Hairline()

                    if (loaded.movements.isEmpty()) {
                        EmptyBox("এখনো কোনো স্টক মুভমেন্ট নেই")
                    } else {
                        loaded.movements.forEach { entry ->
                            MovementRow(entry)
                            Hairline()
                        }
                    }

                    Spacer(Modifier.height(20.dp))
                }
            }
        }
    }

    val current = item
    val direction = movement
    if (current != null && direction != null) {
        MovementSheet(
            direction = direction,
            unit = current.unit,
            onDismiss = { movement = null },
            onConfirm = { quantity, unitCost, note, date ->
                movement = null
                scope.launch {
                    store.addStockMovement(
                        itemId = current.id,
                        direction = direction,
                        quantity = quantity,
                        unitCost = unitCost,
                        note = note,
                        date = date,
                    )
                    // The server recomputes the quantity; reload rather than
                    // adding the movement to a number we hold locally.
                    onReload()
                }
            },
        )
    }
}

@Composable
private fun ItemHeader(item: StockItem) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(TallyColors.CardCream)
            .padding(horizontal = 14.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = item.quantityLabel,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            if (item.lowStock) LowStockChip(item.lowStockLabel.ifBlank { "স্টক কম" })
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = item.valueLabel,
            fontSize = 14.sp,
            color = TallyColors.TextBody,
            maxLines = 1,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = item.priceLabel,
            fontSize = 12.sp,
            color = TallyColors.TextSecondary,
            maxLines = 1,
        )
        if (item.note.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = item.note,
                fontSize = 12.5.sp,
                color = TallyColors.TextSecondary,
                lineHeight = 17.sp,
            )
        }
        if (item.lastMovementLabel.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = item.lastMovementLabel,
                fontSize = 12.sp,
                color = TallyColors.TextHint,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun MovementRow(entry: StockMovementItem) {
    val inbound = entry.tone != "out"
    Row(
        Modifier
            .fillMaxWidth()
            .height(62.dp)
            .padding(start = 16.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = entry.title,
                fontSize = 14.5.sp,
                color = TallyColors.TextPrimary,
                maxLines = 1,
            )
            if (entry.subtitle.isNotBlank()) {
                Spacer(Modifier.height(3.dp))
                Text(
                    text = entry.subtitle,
                    fontSize = 12.sp,
                    color = TallyColors.TextSecondary,
                    maxLines = 1,
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = entry.quantityLabel,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (inbound) TallyColors.ZeroGreen else TallyColors.RowRedIcon,
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = entry.amountLabel,
                fontSize = 11.5.sp,
                color = TallyColors.TextSecondary,
                maxLines = 1,
            )
        }
    }
}

/**
 * স্টক ইন / স্টক আউট entry sheet.
 *
 * The date defaults to today and is editable, reusing the same hand-rolled
 * Bengali calendar as the ledger and cash forms — the wire format is noon-local
 * so the chosen day survives the round trip.
 */
@Composable
private fun MovementSheet(
    direction: String,
    unit: String,
    onDismiss: () -> Unit,
    onConfirm: (quantity: String, unitCost: String, note: String, date: Date) -> Unit,
) {
    val inbound = direction != "out"
    var quantity by remember { mutableStateOf("") }
    var unitCost by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(Date()) }
    var showDatePicker by remember { mutableStateOf(false) }

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
                .background(Color.White)
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = if (inbound) "স্টক ইন করুন" else "স্টক আউট করুন",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
            )
            Spacer(Modifier.height(14.dp))

            TallyField(
                value = quantity,
                onValueChange = { quantity = it },
                placeholder = "পরিমাণ ($unit)",
                icon = TallyIcons.Box,
            )
            Spacer(Modifier.height(12.dp))
            TallyField(
                value = unitCost,
                onValueChange = { unitCost = it },
                placeholder = "একক দাম",
                prefix = "৳",
            )
            Spacer(Modifier.height(12.dp))
            TallyField(
                value = note,
                onValueChange = { note = it },
                placeholder = "বিবরণ",
                icon = TallyIcons.NoteEdit,
            )

            Spacer(Modifier.height(12.dp))
            PillButton(
                label = toBengaliDateShort(date),
                background = TallyColors.SoftPill,
                textColor = TallyColors.TextBody,
                icon = TallyIcons.Calendar,
                iconColor = TallyColors.TextBody,
                onClick = { showDatePicker = true },
            )

            Spacer(Modifier.height(16.dp))
            ConfirmButton(
                label = if (inbound) "স্টক ইন" else "স্টক আউট",
                enabled = quantity.isNotBlank(),
                onClick = { onConfirm(quantity, unitCost, note, date) },
            )
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(46.dp)
                    .clickable { onDismiss() },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "বাতিল",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextSecondary,
                )
            }
            Spacer(Modifier.navigationBarsPadding())
        }
    }

    if (showDatePicker) {
        TallyDatePickerDialog(
            initial = date,
            onDismiss = { showDatePicker = false },
            onConfirm = {
                date = it
                showDatePicker = false
            },
        )
    }
}
