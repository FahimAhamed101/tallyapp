package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.NoteItem
import kotlinx.coroutines.launch

/**
 * ব্যবসার নোট — checklist screen behind the home tab's third tile.
 *
 * Matching reference screenshots:
 * - Back button + "ব্যবসার নোট" + subtitle (username/store) + "? হেল্প" chip
 * - Checkbox list with strikethrough on completion
 * - Red '+' FAB transforms into '✓' button when inline input is open
 */
@Composable
fun BusinessNotesScreen(
    store: AppStore,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var isAdding by remember { mutableStateOf(false) }
    var newText by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        store.refreshNotes()
    }

    LaunchedEffect(isAdding) {
        if (isAdding) {
            focusRequester.requestFocus()
        }
    }

    fun submitNote() {
        val trimmed = newText.trim()
        if (trimmed.isNotBlank()) {
            scope.launch {
                store.addNote(trimmed)
                newText = ""
                isAdding = false
            }
        } else {
            isAdding = false
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White),
    ) {
        // Toolbar with subtitle and '? হেল্প' chip
        Column {
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(64.dp)
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
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "ব্যবসার নোট",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.TextPrimary,
                    )
                    val subtitle = store.toolbarName
                    if (subtitle.isNotBlank()) {
                        Text(
                            text = subtitle,
                            fontSize = 13.sp,
                            color = Color(0xFF6B7280),
                        )
                    }
                }
                // '? হেল্প' Chip
                HelpChip()
            }
            Hairline()
        }

        ErrorBanner(store) { scope.launch { store.refreshNotes() } }

        Box(Modifier.weight(1f)) {
            LazyColumn(
                Modifier
                    .fillMaxSize()
                    .padding(top = 12.dp),
            ) {
                // Inline entry row at top when adding
                if (isAdding) {
                    item {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(Color(0xFFF9FAFB))
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier
                                    .size(20.dp)
                                    .border(1.8.dp, Color(0xFF374151), RoundedCornerShape(3.dp)),
                            )
                            Spacer(Modifier.width(14.dp))
                            BasicTextField(
                                value = newText,
                                onValueChange = { newText = it },
                                modifier = Modifier
                                    .weight(1f)
                                    .focusRequester(focusRequester),
                                textStyle = TextStyle(
                                    fontSize = 15.sp,
                                    color = TallyColors.TextPrimary,
                                ),
                                cursorBrush = SolidColor(TallyColors.CtaRed),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(onDone = { submitNote() }),
                            )
                        }
                    }
                }

                items(store.notes, key = { it.id }) { note ->
                    NoteRow(
                        note = note,
                        onToggle = { done ->
                            scope.launch { store.toggleNote(note.id, done) }
                        },
                        onDelete = {
                            scope.launch { store.deleteNote(note.id) }
                        },
                    )
                }

                if (store.notes.isEmpty() && !isAdding) {
                    item {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 80.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "কোনো নোট নেই। নিচে + ট্যাপ করে নতুন নোট যোগ করুন।",
                                fontSize = 14.sp,
                                color = Color(0xFF9CA3AF),
                            )
                        }
                    }
                }
            }

            // Bottom Right Action Button
            if (isAdding) {
                val hasText = newText.trim().isNotBlank()
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 18.dp, bottom = 24.dp)
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(if (hasText) Color(0xFF108A00) else Color(0xFF9CA3AF))
                        .clickable { submitNote() },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Check, Color.White, 26.dp, strokeWidth = 2.4f)
                }
            } else {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 18.dp, bottom = 24.dp)
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(TallyColors.CtaRed)
                        .clickable {
                            isAdding = true
                            newText = ""
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    LineIcon(TallyIcons.Plus, Color.White, 26.dp, strokeWidth = 2.4f)
                }
            }
        }
    }
}

@Composable
private fun NoteRow(
    note: NoteItem,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onToggle(!note.done) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Checkbox square
        Box(
            Modifier
                .size(20.dp)
                .border(
                    width = 1.8.dp,
                    color = if (note.done) Color(0xFF108A00) else Color(0xFF374151),
                    shape = RoundedCornerShape(3.dp),
                )
                .background(
                    if (note.done) Color(0xFF108A00) else Color.Transparent,
                    RoundedCornerShape(3.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (note.done) {
                LineIcon(TallyIcons.Check, Color.White, 14.dp, strokeWidth = 2.5f)
            }
        }
        Spacer(Modifier.width(14.dp))
        Text(
            text = note.text,
            fontSize = 15.sp,
            color = if (note.done) Color(0xFF9CA3AF) else TallyColors.TextPrimary,
            textDecoration = if (note.done) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.weight(1f),
        )
        // Subtle delete button
        Box(
            Modifier
                .size(32.dp)
                .clickable { onDelete() },
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(TallyIcons.Trash, Color(0xFFD1D5DB), 17.dp, strokeWidth = 1.6f)
        }
    }
}

/** '? হেল্প' rounded pill chip in toolbar */
@Composable
fun HelpChip(onClick: () -> Unit = {}) {
    Row(
        Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFFF3F4F6))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(TallyIcons.Help, Color(0xFF374151), 16.dp, strokeWidth = 1.8f)
        Spacer(Modifier.width(4.dp))
        Text(
            text = "হেল্প",
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF374151),
        )
    }
}
