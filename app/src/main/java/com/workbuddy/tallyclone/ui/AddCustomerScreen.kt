package com.workbuddy.tallyclone.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CustomerItem
import com.workbuddy.tallyclone.data.ImagePicking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * নতুন কাস্টমার/সাপ্লায়ার — the add form, and (when [customer] is not null) the
 * same form in edit mode.
 *
 * The photo is uploaded the moment it is picked, from either the camera or the
 * gallery, so "নিশ্চিত" only has to save text. Cloudinary never sees the device
 * directly: the bytes go to our own /api/uploads route as a base64 data URI and
 * the server does the signed upload.
 */
@Composable
fun AddCustomerScreen(
    store: AppStore,
    customer: CustomerItem? = null,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val editing = customer != null

    var isCustomer by remember { mutableStateOf(customer?.type != "supplier") }
    var name by remember { mutableStateOf(customer?.name.orEmpty()) }
    var phone by remember { mutableStateOf(customer?.phone.orEmpty()) }
    var note by remember { mutableStateOf(customer?.note.orEmpty()) }

    // Photo state. `photoDirty` keeps an untouched photo out of the PATCH body
    // so the server never re-writes (or destroys) an asset we did not change.
    var photoUrl by remember { mutableStateOf(customer?.photoUrl.orEmpty()) }
    var photoPublicId by remember { mutableStateOf("") }
    var photoDirty by remember { mutableStateOf(false) }

    var uploading by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var showPicker by remember { mutableStateOf(false) }
    var localError by remember { mutableStateOf<String?>(null) }

    // The camera writes into our cache dir; we hold both halves of that pair.
    var cameraTarget by remember { mutableStateOf<Pair<Uri, File>?>(null) }

    /** Downsample + upload whatever the user just produced. */
    fun upload(uri: Uri, cleanup: () -> Unit) {
        scope.launch {
            uploading = true
            localError = null
            val dataUri = withContext(Dispatchers.IO) { ImagePicking.toDataUri(context, uri) }
            cleanup()
            if (dataUri == null) {
                localError = "ছবিটি পড়া যায়নি, অন্য ছবি চেষ্টা করুন"
                uploading = false
                return@launch
            }
            store.uploadImage(dataUri, folder = "customers")
                .onSuccess {
                    photoUrl = it.url
                    photoPublicId = it.publicId
                    photoDirty = true
                }
                .onFailure { localError = it.message ?: "ছবি আপলোড করা যায়নি" }
            uploading = false
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { saved ->
        val target = cameraTarget
        cameraTarget = null
        if (saved && target != null) {
            // Read from the FileProvider URI, then drop the scratch file.
            upload(target.first) { ImagePicking.discard(target.second) }
        } else {
            ImagePicking.discard(target?.second)
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri -> if (uri != null) upload(uri) { } }

    val canSubmit = name.isNotBlank() && !submitting && !uploading

    fun submit() {
        if (!canSubmit) return
        submitting = true
        localError = null
        scope.launch {
            val result = if (editing) {
                store.updateCustomer(
                    id = customer!!.id,
                    name = name.trim(),
                    phone = phone.trim(),
                    type = if (isCustomer) "customer" else "supplier",
                    note = note.trim(),
                    photoUrl = if (photoDirty) photoUrl else null,
                    photoPublicId = if (photoDirty) photoPublicId else null,
                )
            } else {
                store.addCustomer(
                    name = name.trim(),
                    phone = phone.trim(),
                    type = if (isCustomer) "customer" else "supplier",
                    note = note.trim(),
                    photoUrl = photoUrl,
                    photoPublicId = photoPublicId,
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
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))

            // --- toolbar ---------------------------------------------------
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(start = 8.dp, end = 16.dp),
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
                    text = if (editing) "সম্পাদনা করুন" else "নতুন কাস্টমার/সাপ্লায়ার",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = TallyColors.TextPrimary,
                    maxLines = 1,
                )
            }
            Hairline()

            ErrorBanner(store) { submit() }

            // --- body ------------------------------------------------------
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
            ) {
                Spacer(Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    AvatarWithCamera(
                        photoUrl = photoUrl.takeIf { it.isNotBlank() },
                        uploading = uploading,
                        onClick = { showPicker = true },
                    )
                    Spacer(Modifier.width(14.dp))
                    RadioPill(
                        label = "কাস্টমার",
                        selected = isCustomer,
                        modifier = Modifier.weight(1f),
                    ) { isCustomer = true }
                    Spacer(Modifier.width(10.dp))
                    RadioPill(
                        label = "সাপ্লায়ার",
                        selected = !isCustomer,
                        modifier = Modifier.weight(1f),
                    ) { isCustomer = false }
                }

                Spacer(Modifier.height(10.dp))

                // Camera / gallery affordance, spelled out so the two sources
                // are obvious without having to discover the avatar tap.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(Modifier.width(58.dp + 14.dp))
                    PhotoChip(
                        label = "ক্যামেরা",
                        icon = TallyIcons.Camera,
                        enabled = !uploading,
                    ) {
                        val target = ImagePicking.newCameraTarget(context)
                        cameraTarget = target
                        cameraLauncher.launch(target.first)
                    }
                    Spacer(Modifier.width(8.dp))
                    PhotoChip(
                        label = "গ্যালারি",
                        icon = TallyIcons.Gallery,
                        enabled = !uploading,
                    ) { galleryLauncher.launch("image/*") }
                }

                Spacer(Modifier.height(14.dp))

                // ফোনবুক থেকে যোগ করি
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(50))
                        .background(TallyColors.FieldGray)
                        .clickable { }
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    LineIcon(TallyIcons.ContactBook, TallyColors.TextPrimary, 22.dp, strokeWidth = 1.7f)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "ফোনবুক থেকে যোগ করি",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = TallyColors.TextPrimary,
                        maxLines = 1,
                    )
                }

                Spacer(Modifier.height(22.dp))

                TallyField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = "নাম",
                    icon = TallyIcons.Person,
                )
                Spacer(Modifier.height(16.dp))
                TallyField(
                    value = phone,
                    onValueChange = { phone = it },
                    placeholder = "মোবাইল নম্বর",
                    icon = TallyIcons.Phone,
                )
                Spacer(Modifier.height(16.dp))
                TallyField(
                    value = note,
                    onValueChange = { note = it },
                    placeholder = "বিবরণ",
                    icon = TallyIcons.NoteEdit,
                )

                val message = localError ?: store.error
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
                label = when {
                    uploading -> "ছবি আপলোড হচ্ছে…"
                    submitting -> "সংরক্ষণ হচ্ছে…"
                    else -> "নিশ্চিত"
                },
                enabled = canSubmit,
                modifier = Modifier.padding(horizontal = 16.dp),
                onClick = { submit() },
            )
            Spacer(Modifier.height(16.dp))
            Spacer(Modifier.navigationBarsPadding())
        }

        if (showPicker) {
            PhotoSourceSheet(
                hasPhoto = photoUrl.isNotBlank(),
                onCamera = {
                    showPicker = false
                    val target = ImagePicking.newCameraTarget(context)
                    cameraTarget = target
                    cameraLauncher.launch(target.first)
                },
                onGallery = {
                    showPicker = false
                    galleryLauncher.launch("image/*")
                },
                onRemove = {
                    showPicker = false
                    // Empty both fields and mark dirty so the server clears and
                    // destroys the Cloudinary asset.
                    photoUrl = ""
                    photoPublicId = ""
                    photoDirty = true
                },
                onDismiss = { showPicker = false },
            )
        }
    }
}

/** Small "ক্যামেরা" / "গ্যালারি" capsule under the avatar. */
@Composable
private fun PhotoChip(
    label: String,
    icon: List<String>,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .height(34.dp)
            .clip(RoundedCornerShape(50))
            .background(TallyColors.SoftPill)
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LineIcon(icon, TallyColors.TextPrimary, 18.dp, strokeWidth = 1.8f)
        Spacer(Modifier.width(6.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = TallyColors.TextPrimary,
            maxLines = 1,
        )
    }
}

/** Bottom sheet offering the two photo sources (plus remove, when relevant). */
@Composable
private fun PhotoSourceSheet(
    hasPhoto: Boolean,
    onCamera: () -> Unit,
    onGallery: () -> Unit,
    onRemove: () -> Unit,
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
                .background(Color.White)
                .padding(top = 10.dp, bottom = 10.dp),
        ) {
            Box(
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(TallyColors.DividerGray),
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "ছবি যোগ করুন",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TallyColors.TextPrimary,
                modifier = Modifier.padding(start = 20.dp, bottom = 6.dp),
            )

            SheetRow("ক্যামেরায় ছবি তুলুন", TallyIcons.Camera, onCamera)
            SheetRow("গ্যালারি থেকে বাছুন", TallyIcons.Gallery, onGallery)
            if (hasPhoto) SheetRow("ছবি সরান", TallyIcons.Trash, onRemove)

            Spacer(Modifier.height(6.dp))
            Hairline()
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(50.dp)
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
}

@Composable
private fun SheetRow(label: String, icon: List<String>, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clickable { onClick() }
            .padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(TallyColors.SoftPill),
            contentAlignment = Alignment.Center,
        ) {
            LineIcon(icon, TallyColors.NavRed, 20.dp, strokeWidth = 1.8f)
        }
        Spacer(Modifier.width(14.dp))
        Text(
            text = label,
            fontSize = 15.sp,
            color = TallyColors.TextPrimary,
            maxLines = 1,
        )
    }
}
