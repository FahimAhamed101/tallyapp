package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Hand-authored 24x24 line-art icon set. The reference app draws each service
 * icon as a coloured outline with a soft pastel "shadow" offset a hair
 * down-right; [SoftIcon] reproduces that by stroking the same path twice.
 *
 * All paths are plain SVG path data so they stay readable and easy to tweak.
 */
object TallyIcons {

    // ---------- home service grid ----------

    val Book = listOf(
        "M12 6.5C10.2 5.1 7.3 4.4 4.6 4.7L4.6 18.3C7.3 18 10.2 18.7 12 20.1" +
            "C13.8 18.7 16.7 18 19.4 18.3L19.4 4.7C16.7 4.4 13.8 5.1 12 6.5Z",
        "M12 6.5L12 20.1",
        "M7.3 8.3C8.2 8.4 9.1 8.7 9.9 9.1",
        "M7.3 11.5C8.2 11.6 9.1 11.9 9.9 12.3",
        "M14.1 9.1C14.9 8.7 15.8 8.4 16.7 8.3",
        "M14.1 12.3C14.9 11.9 15.8 11.6 16.7 11.5",
    )

    val Box = listOf(
        "M12 3.3L20 7.4L12 11.5L4 7.4Z",
        "M4 7.4L4 16.6L12 20.7L12 11.5",
        "M20 7.4L20 16.6L12 20.7",
        "M4.7 8.5L12 12.3L19.3 8.5",
    )

    val StoreFront = listOf(
        "M5 4C4.4 4 4 4.4 4 5V19C4 19.6 4.4 20 5 20H19C19.6 20 20 19.6 20 19V5C20 4.4 19.6 4 19 4H5Z",
        "M4 9H20",
        "M9.5 9V14L12 12.5L14.5 14V9",
    )

    val InventoryBox = listOf(
        "M4.5 6C4.5 5.4 5 5 5.6 5H18.4C19 5 19.5 5.4 19.5 6V8.5H4.5V6Z",
        "M5.5 8.5V17.5C5.5 18.3 6.2 19 7 19H17C17.8 19 18.5 18.3 18.5 17.5V8.5",
        "M10 13H14",
    )


    val Note = listOf(
        "M6.4 4.6L17.6 4.6C18.2 4.6 18.6 5 18.6 5.6L18.6 18.4" +
            "C18.6 19 18.2 19.4 17.6 19.4L6.4 19.4C5.8 19.4 5.4 19 5.4 18.4" +
            "L5.4 5.6C5.4 5 5.8 4.6 6.4 4.6Z",
        "M8.8 8.6L15.2 8.6",
        "M8.8 12L15.2 12",
        "M8.8 15.4L12.4 15.4",
    )

    val Bell = listOf(
        "M12 4.2C9 4.2 6.8 6.6 6.8 9.6L6.8 14.2L5.2 16.4L18.8 16.4L17.2 14.2L17.2 9.6" +
            "C17.2 6.6 15 4.2 12 4.2Z",
        "M10.2 18.4C10.2 19.6 11 20.5 12 20.5C13 20.5 13.8 19.6 13.8 18.4",
        "M5.1 6.5C4.3 7.3 3.8 8.2 3.7 9.2",
        "M18.9 6.5C19.7 7.3 20.2 8.2 20.3 9.2",
    )

    val Qr = listOf(
        "M4.5 4.5L10.5 4.5L10.5 10.5L4.5 10.5Z",
        "M13.5 4.5L19.5 4.5L19.5 10.5L13.5 10.5Z",
        "M4.5 13.5L10.5 13.5L10.5 19.5L4.5 19.5Z",
        "M13.6 13.6L15.6 13.6L15.6 15.6L13.6 15.6Z",
        "M17.4 13.6L19.4 13.6L19.4 15.6L17.4 15.6Z",
        "M13.6 17.4L15.6 17.4L15.6 19.4L13.6 19.4Z",
        "M17.4 17.4L19.4 17.4L19.4 19.4L17.4 19.4Z",
    )

    val Cloud = listOf(
        "M7.8 18.2C5.6 18.2 3.8 16.4 3.8 14.2C3.8 12.2 5.3 10.6 7.2 10.2" +
            "C7.8 7.7 10 6 12.5 6C15.3 6 17.6 8.3 17.6 11.1L18 11.1" +
            "C19.9 11.1 21.4 12.6 21.4 14.5C21.4 16.4 19.9 18.2 18 18.2Z",
        "M12.6 15.6L12.6 9.6",
        "M10.2 11.9L12.6 9.5L15 11.9",
    )

    val Chat = listOf(
        "M4.2 6.6C4.2 5.2 5.3 4.1 6.7 4.1L17.3 4.1C18.7 4.1 19.8 5.2 19.8 6.6" +
            "L19.8 14.2C19.8 15.6 18.7 16.7 17.3 16.7L10.2 16.7L5.6 20.3L5.6 16.7" +
            "C4.8 16.7 4.2 16 4.2 15.1Z",
        "M12 13.6L12 8.4",
        "M9.7 10.7L12 8.4L14.3 10.7",
    )

    val Envelope = listOf(
        "M3.5 8.8L12 4.2L20.5 8.8L20.5 17.6C20.5 18.7 19.6 19.6 18.5 19.6" +
            "L5.5 19.6C4.4 19.6 3.5 18.7 3.5 17.6Z",
        "M3.5 8.8L12 12.9L20.5 8.8",
    )

    // ---------- wallet services (all shown muted) ----------

    val AddMoney = listOf(
        "M4.2 8.6C4.2 7.5 5.1 6.6 6.2 6.6L17.8 6.6C18.9 6.6 19.8 7.5 19.8 8.6" +
            "L19.8 15.4C19.8 16.5 18.9 17.4 17.8 17.4L6.2 17.4C5.1 17.4 4.2 16.5 4.2 15.4Z",
        "M12 9.6L12 14.4",
        "M9.6 12L14.4 12",
    )

    val SendMoney = listOf(
        "M20.4 3.6L3.6 10.4L10.4 13.6L13.6 20.4Z",
        "M20.4 3.6L10.4 13.6",
    )

    val BankTransfer = listOf(
        "M3.6 9.4L12 4.2L20.4 9.4",
        "M5.6 9.4L5.6 17.4",
        "M18.4 9.4L18.4 17.4",
        "M9.6 9.4L9.6 17.4",
        "M14.4 9.4L14.4 17.4",
        "M3.6 19.6L20.4 19.6",
    )

    val WalletTransfer = listOf(
        "M4.2 7.4C4.2 6.4 5 5.6 6 5.6L15.4 5.6C16.4 5.6 17.2 6.4 17.2 7.4" +
            "L17.2 8.4L6.2 8.4C5.2 8.4 4.4 9.2 4.4 10.2L4.4 16.4" +
            "C4.4 17.4 5.2 18.2 6.2 18.2L18.2 18.2C19.2 18.2 20 17.4 20 16.4" +
            "L20 10.2C20 9.2 19.2 8.4 18.2 8.4",
        "M15.8 13.4L18 13.4",
    )

    val MobileRecharge = listOf(
        "M8.4 3.4L15.6 3.4C16.6 3.4 17.4 4.2 17.4 5.2L17.4 18.8" +
            "C17.4 19.8 16.6 20.6 15.6 20.6L8.4 20.6C7.4 20.6 6.6 19.8 6.6 18.8" +
            "L6.6 5.2C6.6 4.2 7.4 3.4 8.4 3.4Z",
        "M10.8 17.6L13.2 17.6",
    )

    val TallyTransfer = listOf(
        "M4.2 6.6C4.2 5.2 5.3 4.1 6.7 4.1L17.3 4.1C18.7 4.1 19.8 5.2 19.8 6.6" +
            "L19.8 14.2C19.8 15.6 18.7 16.7 17.3 16.7L10.2 16.7L5.6 20.3L5.6 16.7" +
            "C4.8 16.7 4.2 16 4.2 15.1Z",
        "M9.4 10.4L14.6 10.4",
        "M12.6 8.2L14.8 10.4L12.6 12.6",
    )

    val BillPayment = listOf(
        "M7.4 3.4L16.6 3.4C17.2 3.4 17.6 3.8 17.6 4.4L17.6 19.8L14.2 17.6" +
            "L12 19.8L9.8 17.6L6.4 19.8L6.4 4.4C6.4 3.8 6.8 3.4 7.4 3.4Z",
        "M9.6 8.4L14.4 8.4",
        "M9.6 12.4L14.4 12.4",
    )

    // ---------- toolbar ----------

    val Inbox = listOf(
        "M4.4 12.6L7.2 12.6L8.7 15.1L15.3 15.1L16.8 12.6L19.6 12.6",
        "M4.4 12.6L4.4 17.4C4.4 18 4.8 18.4 5.4 18.4L18.6 18.4" +
            "C19.2 18.4 19.6 18 19.6 17.4L19.6 12.6",
        "M12 5.4L12 11.4",
        "M9.4 9L12 11.6L14.6 9",
    )

    val Support = listOf(
        "M4.6 13.6L4.6 11.6C4.6 7.5 7.9 4.2 12 4.2C16.1 4.2 19.4 7.5 19.4 11.6L19.4 13.6",
        "M4.6 12.4L6.6 12.4C7.2 12.4 7.6 12.8 7.6 13.4L7.6 17" +
            "C7.6 17.6 7.2 18 6.6 18L5.6 18C5 18 4.6 17.6 4.6 17Z",
        "M19.4 12.4L17.4 12.4C16.8 12.4 16.4 12.8 16.4 13.4L16.4 17" +
            "C16.4 17.6 16.8 18 17.4 18L18.4 18C19 18 19.4 17.6 19.4 17Z",
    )

    val Crown = listOf("M4.2 8.2L7.8 11.4L12 5.6L16.2 11.4L19.8 8.2L18.1 17.8L5.9 17.8Z")

    // ---------- search row ----------

    val Search = listOf(
        "M11 4.6C7.5 4.6 4.6 7.5 4.6 11C4.6 14.5 7.5 17.4 11 17.4" +
            "C14.5 17.4 17.4 14.5 17.4 11C17.4 7.5 14.5 4.6 11 4.6Z",
        "M15.6 15.6L20 20",
    )

    val Filter = listOf(
        "M3.8 8.2L20.2 8.2",
        "M3.8 15.8L20.2 15.8",
        "M9.4 8.2C9.4 9.3 8.5 10.2 7.4 10.2C6.3 10.2 5.4 9.3 5.4 8.2" +
            "C5.4 7.1 6.3 6.2 7.4 6.2C8.5 6.2 9.4 7.1 9.4 8.2Z",
        "M18.6 15.8C18.6 16.9 17.7 17.8 16.6 17.8C15.5 17.8 14.6 16.9 14.6 15.8" +
            "C14.6 14.7 15.5 13.8 16.6 13.8C17.7 13.8 18.6 14.7 18.6 15.8Z",
    )

    val Download = listOf(
        "M12 4.2L12 14.8",
        "M7.6 10.4L12 14.8L16.4 10.4",
        "M4.6 19.6L19.4 19.6",
    )

    // ---------- list + CTA ----------

    val ChevronRight = listOf("M9.5 5.5L16 12L9.5 18.5")
    val ChevronLeft = listOf("M14.5 5.5L8 12L14.5 18.5")
    val ChevronDown = listOf("M5.5 9.5L12 16L18.5 9.5")
    val ArrowLeft = listOf("M19 12L5 12", "M12 19L5 12L12 5")

    val PersonPlus = listOf(
        "M9.6 11.4C12 11.4 13.9 9.5 13.9 7.1C13.9 4.7 12 2.8 9.6 2.8" +
            "C7.2 2.8 5.3 4.7 5.3 7.1C5.3 9.5 7.2 11.4 9.6 11.4Z",
        "M2.8 20.4C2.8 16.6 5.9 13.6 9.6 13.6C11.2 13.6 12.6 14.1 13.7 14.9",
        "M17.6 14.4L17.6 21",
        "M14.3 17.7L20.9 17.7",
    )

    val Person = listOf(
        "M12 11.4C14.4 11.4 16.3 9.5 16.3 7.1C16.3 4.7 14.4 2.8 12 2.8" +
            "C9.6 2.8 7.7 4.7 7.7 7.1C7.7 9.5 9.6 11.4 12 11.4Z",
        "M4.6 20.4C4.6 16.4 7.9 13.2 12 13.2C16.1 13.2 19.4 16.4 19.4 20.4",
    )

    val Phone = listOf(
        "M8.2 3.6L10.4 3.6C10.9 3.6 11.3 3.9 11.4 4.4L12 7.4" +
            "C12.1 7.8 11.9 8.3 11.5 8.6L9.8 9.9C10.9 12.3 12.9 14.3 15.3 15.4" +
            "L16.6 13.7C16.9 13.3 17.4 13.1 17.8 13.2L20.8 13.8" +
            "C21.3 13.9 21.6 14.3 21.6 14.8L21.6 17C21.6 17.8 20.9 18.5 20.1 18.4" +
            "C11.9 17.8 5.4 11.3 4.8 3.1C4.7 2.3 5.4 1.6 6.2 1.6",
    )

    val ContactBook = listOf(
        "M6.4 3.4L17.6 3.4C18.4 3.4 19 4 19 4.8L19 19.2" +
            "C19 20 18.4 20.6 17.6 20.6L6.4 20.6C5.6 20.6 5 20 5 19.2L5 4.8" +
            "C5 4 5.6 3.4 6.4 3.4Z",
        "M8.6 3.4L8.6 20.6",
        "M13.4 9.4L15.8 9.4",
        "M13.4 14.4L15.8 14.4",
    )

    val Camera = listOf(
        "M3.6 9.4C3.6 8.4 4.4 7.6 5.4 7.6L7.4 7.6L8.6 5.4L15.4 5.4L16.6 7.6L18.6 7.6" +
            "C19.6 7.6 20.4 8.4 20.4 9.4L20.4 17.4C20.4 18.4 19.6 19.2 18.6 19.2" +
            "L5.4 19.2C4.4 19.2 3.6 18.4 3.6 17.4Z",
        "M12 15.8C13.7 15.8 15 14.5 15 12.8C15 11.1 13.7 9.8 12 9.8" +
            "C10.3 9.8 9 11.1 9 12.8C9 14.5 10.3 15.8 12 15.8Z",
    )

    val Calendar = listOf(
        "M4.4 6.6C4.4 5.6 5.2 4.8 6.2 4.8L17.8 4.8C18.8 4.8 19.6 5.6 19.6 6.6" +
            "L19.6 18.4C19.6 19.4 18.8 20.2 17.8 20.2L6.2 20.2C5.2 20.2 4.4 19.4 4.4 18.4Z",
        "M4.4 10.4L19.6 10.4",
        "M8.4 3.2L8.4 6.4",
        "M15.6 3.2L15.6 6.4",
    )

    val Eye = listOf(
        "M2.6 12C4.6 8.2 8.1 6.2 12 6.2C15.9 6.2 19.4 8.2 21.4 12" +
            "C19.4 15.8 15.9 17.8 12 17.8C8.1 17.8 4.6 15.8 2.6 12Z",
        "M12 15.2C13.8 15.2 15.2 13.8 15.2 12C15.2 10.2 13.8 8.8 12 8.8" +
            "C10.2 8.8 8.8 10.2 8.8 12C8.8 13.8 10.2 15.2 12 15.2Z",
    )

    val Swap = listOf(
        "M4.4 8.6L15.6 8.6",
        "M12.4 5.4L15.6 8.6L12.4 11.8",
        "M19.6 15.4L8.4 15.4",
        "M11.6 12.2L8.4 15.4L11.6 18.6",
    )

    val Document = listOf(
        "M7 3.4L14.6 3.4L18.4 7.2L18.4 20.6L7 20.6Z",
        "M14.6 3.4L14.6 7.2L18.4 7.2",
        "M9.8 12L15.6 12",
        "M9.8 16L15.6 16",
    )

    val NoteEdit = listOf(
        "M6.6 4.6L14.4 4.6L17.6 7.8L17.6 19.4L6.6 19.4Z",
        "M14.4 4.6L14.4 7.8L17.6 7.8",
        "M9.2 12.4L12.6 12.4",
        "M9.2 16L14 16",
    )

    val Gear = listOf(
        "M12 15.4C13.9 15.4 15.4 13.9 15.4 12C15.4 10.1 13.9 8.6 12 8.6" +
            "C10.1 8.6 8.6 10.1 8.6 12C8.6 13.9 10.1 15.4 12 15.4Z",
        "M19.4 12C19.4 11.6 19.4 11.2 19.3 10.8L21 9.4L19.4 6.6L17.4 7.4" +
            "C16.7 6.8 15.9 6.3 15 6L14.6 4L11.4 4L11 6C10.1 6.3 9.3 6.8 8.6 7.4" +
            "L6.6 6.6L5 9.4L6.7 10.8C6.6 11.2 6.6 11.6 6.6 12C6.6 12.4 6.6 12.8 6.7 13.2" +
            "L5 14.6L6.6 17.4L8.6 16.6C9.3 17.2 10.1 17.7 11 18L11.4 20L14.6 20L15 18" +
            "C15.9 17.7 16.7 17.2 17.4 16.6L19.4 17.4L21 14.6L19.3 13.2" +
            "C19.4 12.8 19.4 12.4 19.4 12Z",
    )

    val Tag = listOf(
        "M11.6 3.4L20.6 12.4L12.4 20.6L3.4 11.6L3.4 3.4Z",
        "M7.6 7.6L8.4 7.6",
    )

    val Chart = listOf(
        "M4.4 20.4L20.4 20.4",
        "M6.8 20.4L6.8 12.4",
        "M11.4 20.4L11.4 5.4",
        "M16 20.4L16 9.4",
        "M20.2 20.4L20.2 15.4",
    )

    val ArrowOut = listOf(
        "M13.4 4.6L19.4 4.6L19.4 10.6",
        "M19.4 4.6L11.4 12.6",
        "M17.4 14.4L17.4 18.4C17.4 19.1 16.8 19.7 16.1 19.7L5.6 19.7" +
            "C4.9 19.7 4.3 19.1 4.3 18.4L4.3 7.9C4.3 7.2 4.9 6.6 5.6 6.6L9.6 6.6",
    )

    val InboxDoc = listOf(
        "M4.4 11.4L4.4 6.4C4.4 5.7 4.9 5.2 5.6 5.2L18.4 5.2" +
            "C19.1 5.2 19.6 5.7 19.6 6.4L19.6 11.4",
        "M4.4 11.4L7.4 11.4L8.9 14L15.1 14L16.6 11.4L19.6 11.4",
        "M4.4 11.4L4.4 17.6C4.4 18.3 4.9 18.8 5.6 18.8L18.4 18.8" +
            "C19.1 18.8 19.6 18.3 19.6 17.6L19.6 11.4",
    )

    val Gift = listOf(
        "M3.6 11.4L20.4 11.4L20.4 20.4L3.6 20.4Z",
        "M3.6 7.4L20.4 7.4L20.4 11.4L3.6 11.4Z",
        "M12 7.4L12 20.4",
        "M12 7.4C12 7.4 9.6 7.4 8.6 6.4C7.8 5.6 7.8 4.4 8.6 3.8" +
            "C9.6 3.1 11.2 3.8 12 5.4C12.8 3.8 14.4 3.1 15.4 3.8" +
            "C16.2 4.4 16.2 5.6 15.4 6.4C14.4 7.4 12 7.4 12 7.4Z",
    )

    val Info = listOf(
        "M12 3.6C16.6 3.6 20.4 7.4 20.4 12C20.4 16.6 16.6 20.4 12 20.4" +
            "C7.4 20.4 3.6 16.6 3.6 12C3.6 7.4 7.4 3.6 12 3.6Z",
        "M12 11L12 16",
        "M12 8.2L12 8.4",
    )

    val MoreVertical = listOf(
        "M12 5.6L12 5.8",
        "M12 12L12 12.2",
        "M12 18.4L12 18.6",
    )

    val Check = listOf("M5 12.6L9.8 17.4L19 6.6")

    val Plus = listOf(
        "M12 5L12 19",
        "M5 12L19 12",
    )

    val Help = listOf(
        "M12 3C7 3 3 7 3 12C3 17 7 21 12 21C17 21 21 17 21 12C21 7 17 3 12 3Z",
        "M9.8 9.2C9.8 7.8 10.8 6.8 12 6.8C13.2 6.8 14.2 7.8 14.2 9C14.2 10.1 13.5 10.7 12.8 11.2C12.2 11.7 11.8 12.3 11.8 13.2",
        "M11.8 16.5L12 16.5",
    )

    val Key = listOf(
        "M7.5 15.5C9.4 15.5 11 13.9 11 12C11 10.1 9.4 8.5 7.5 8.5C5.6 8.5 4 10.1 4 12C4 13.9 5.6 15.5 7.5 15.5Z",
        "M11 12L20 12L20 15",
        "M17 12L17 14.5",
        "M6.5 12L6.7 12",
    )

    // ---------- auth + photo editing ----------

    /** পাসওয়ার্ড field / login screen padlock. */
    val Lock = listOf(
        "M6.4 10.6L17.6 10.6C18.4 10.6 19 11.2 19 12L19 18.6" +
            "C19 19.4 18.4 20 17.6 20L6.4 20C5.6 20 5 19.4 5 18.6" +
            "L5 12C5 11.2 5.6 10.6 6.4 10.6Z",
        "M8.4 10.6L8.4 8.2C8.4 6.2 10 4.6 12 4.6C14 4.6 15.6 6.2 15.6 8.2L15.6 10.6",
        "M12 14.4L12 16.4",
    )

    /** গ্যালারি থেকে ছবি — framed picture with a sun and a hill. */
    val Gallery = listOf(
        "M4.6 6.6L19.4 6.6C20.1 6.6 20.6 7.1 20.6 7.8L20.6 16.2" +
            "C20.6 16.9 20.1 17.4 19.4 17.4L4.6 17.4C3.9 17.4 3.4 16.9 3.4 16.2" +
            "L3.4 7.8C3.4 7.1 3.9 6.6 4.6 6.6Z",
        "M8.6 10.6C9.4 10.6 10 10 10 9.2C10 8.4 9.4 7.8 8.6 7.8C7.8 7.8 7.2 8.4 7.2 9.2C7.2 10 7.8 10.6 8.6 10.6Z",
        "M3.6 15.6L9.2 11.2L13.6 14.8L16.4 12.6L20.4 15.8",
    )

    /** লগআউট — door with an out-arrow. */
    val Logout = listOf(
        "M14.6 4.6L6.4 4.6C5.6 4.6 5 5.2 5 6L5 18C5 18.8 5.6 19.4 6.4 19.4L14.6 19.4",
        "M12 12L20.4 12",
        "M17.6 8.8L20.8 12L17.6 15.2",
    )

    /** Edit an existing customer. */
    val Pencil = listOf(
        "M16.2 4.6L19.4 7.8L9.4 17.8L5.4 18.6L6.2 14.6Z",
        "M14.2 6.6L17.4 9.8",
    )

    /** Remove the attached photo. */
    val Trash = listOf(
        "M5.6 7.4L18.4 7.4",
        "M9.4 7.4L9.4 5.6C9.4 5.2 9.7 4.9 10.1 4.9L13.9 4.9C14.3 4.9 14.6 5.2 14.6 5.6L14.6 7.4",
        "M7.2 7.4L8 18.6C8 19.3 8.6 19.9 9.3 19.9L14.7 19.9C15.4 19.9 16 19.3 16 18.6L16.8 7.4",
        "M10.6 10.6L10.9 16.8",
        "M13.4 10.6L13.1 16.8",
    )

    val HandReceive = listOf(
        "M7.6 12.6L7.6 7.8C7.6 7 8.2 6.4 9 6.4C9.8 6.4 10.4 7 10.4 7.8L10.4 11.6",
        "M10.4 11.6L10.4 6.8C10.4 6 11 5.4 11.8 5.4C12.6 5.4 13.2 6 13.2 6.8L13.2 11.6",
        "M13.2 11.6L13.2 8C13.2 7.2 13.8 6.6 14.6 6.6C15.4 6.6 16 7.2 16 8L16 14.2",
        "M7.6 12.6C7.6 12.6 6.3 11.8 5.7 12.2C5.1 12.6 5.1 13.4 5.6 14L8.5 17.8" +
            "C9.5 19.1 11 19.9 12.7 19.9C15.7 19.9 18.1 17.5 18.1 14.5",
        "M17.6 3.6L17.6 8.4",
        "M15.4 6.2L17.6 8.4L19.8 6.2",
    )

    val HandGive = listOf(
        "M7.6 12.6L7.6 7.8C7.6 7 8.2 6.4 9 6.4C9.8 6.4 10.4 7 10.4 7.8L10.4 11.6",
        "M10.4 11.6L10.4 6.8C10.4 6 11 5.4 11.8 5.4C12.6 5.4 13.2 6 13.2 6.8L13.2 11.6",
        "M13.2 11.6L13.2 8C13.2 7.2 13.8 6.6 14.6 6.6C15.4 6.6 16 7.2 16 8L16 14.2",
        "M7.6 12.6C7.6 12.6 6.3 11.8 5.7 12.2C5.1 12.6 5.1 13.4 5.6 14L8.5 17.8" +
            "C9.5 19.1 11 19.9 12.7 19.9C15.7 19.9 18.1 17.5 18.1 14.5",
        "M17.6 8.4L17.6 3.6",
        "M15.4 5.8L17.6 3.6L19.8 5.8",
    )

    /** Orange "start your ledger" glyph: a hand holding a note with an out-arrow. */
    val HandDoc = listOf(
        "M8.2 12.6L8.2 8.2C8.2 7.4 8.8 6.8 9.6 6.8C10.4 6.8 11 7.4 11 8.2L11 11.6",
        "M11 11.6L11 7.2C11 6.4 11.6 5.8 12.4 5.8C13.2 5.8 13.8 6.4 13.8 7.2L13.8 11.6",
        "M13.8 11.6L13.8 8.4C13.8 7.6 14.4 7 15.2 7C16 7 16.6 7.6 16.6 8.4L16.6 14.4",
        "M8.2 12.6C8.2 12.6 7 11.8 6.4 12.2C5.8 12.6 5.8 13.4 6.3 14L9.2 17.6" +
            "C10.2 18.8 11.7 19.6 13.4 19.6C16.4 19.6 18.8 17.2 18.8 14.2",
        "M14.2 4.4L19.6 4.4L19.6 9.8",
        "M19.6 4.4L13.8 10.2",
    )

    // ---------- bottom navigation ----------

    val NavTally = listOf(
        "M7.4 2.8L16.6 2.8C17.9 2.8 19 3.9 19 5.2L19 18.8" +
            "C19 20.1 17.9 21.2 16.6 21.2L7.4 21.2C6.1 21.2 5 20.1 5 18.8" +
            "L5 5.2C5 3.9 6.1 2.8 7.4 2.8Z",
        "M7.8 17.6L16.2 17.6",
    )

    val NavCashbox = listOf(
        "M4.6 9.4L12 5.4L19.4 9.4L19.4 17.2C19.4 18.2 18.6 19 17.6 19" +
            "L6.4 19C5.4 19 4.6 18.2 4.6 17.2Z",
        "M4.6 9.4L12 13.2L19.4 9.4",
    )

    /** ওয়ালেট tab - banknote in a rounded frame */
    val NavWallet = listOf(
        "M6.2 4.6L17.8 4.6C18.9 4.6 19.8 5.5 19.8 6.6L19.8 17.4" +
            "C19.8 18.5 18.9 19.4 17.8 19.4L6.2 19.4C5.1 19.4 4.2 18.5 4.2 17.4" +
            "L4.2 6.6C4.2 5.5 5.1 4.6 6.2 4.6Z",
        "M12 15.4C13.9 15.4 15.4 13.9 15.4 12C15.4 10.1 13.9 8.6 12 8.6" +
            "C10.1 8.6 8.6 10.1 8.6 12C8.6 13.9 10.1 15.4 12 15.4Z",
    )

    val NavMenu = listOf(
        "M4.6 7L19.4 7",
        "M4.6 12L19.4 12",
        "M4.6 17L19.4 17",
    )
}

/** Builds a stroke-only [ImageVector] from SVG path data at a 24x24 viewport. */
fun strokeVector(
    paths: List<String>,
    color: Color,
    strokeWidth: Float = 1.7f,
    fill: Boolean = false,
): ImageVector {
    val builder = ImageVector.Builder(
        name = "icon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    )
    paths.forEach { d ->
        builder.addPath(
            pathData = PathParser().parsePathString(d).toNodes(),
            fill = if (fill) SolidColor(color) else null,
            stroke = if (fill) null else SolidColor(color),
            strokeLineWidth = strokeWidth,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }
    return builder.build()
}

/**
 * Draws a line-art icon twice: once in a pastel tint offset down-right
 * (the soft shadow), then the real colour on top.
 */
@Composable
fun SoftIcon(
    paths: List<String>,
    color: Color,
    shadowColor: Color,
    size: Dp,
    strokeWidth: Float = 1.7f,
    modifier: Modifier = Modifier,
) {
    val shadow = remember(paths, shadowColor, strokeWidth) {
        strokeVector(paths, shadowColor, strokeWidth)
    }
    val main = remember(paths, color, strokeWidth) {
        strokeVector(paths, color, strokeWidth)
    }
    Box(modifier.size(size)) {
        Image(
            imageVector = shadow,
            contentDescription = null,
            modifier = Modifier
                .matchParentSize()
                .offset(x = 1.1.dp, y = 1.5.dp),
        )
        Image(
            imageVector = main,
            contentDescription = null,
            modifier = Modifier.matchParentSize(),
        )
    }
}

/** Plain single-colour line icon (no shadow). */
@Composable
fun LineIcon(
    paths: List<String>,
    color: Color,
    size: Dp,
    strokeWidth: Float = 1.7f,
    modifier: Modifier = Modifier,
) {
    val vector = remember(paths, color, strokeWidth) {
        strokeVector(paths, color, strokeWidth)
    }
    Image(
        imageVector = vector,
        contentDescription = null,
        modifier = modifier.size(size),
    )
}

/** Solid filled icon, used for the crown badge and the active bottom tab. */
@Composable
fun SolidIcon(
    paths: List<String>,
    color: Color,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val vector = remember(paths, color) { strokeVector(paths, color, fill = true) }
    Image(
        imageVector = vector,
        contentDescription = null,
        modifier = modifier.size(size),
    )
}
