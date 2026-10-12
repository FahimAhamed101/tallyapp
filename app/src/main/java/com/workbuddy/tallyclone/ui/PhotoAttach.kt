package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.ImagePicking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * The ছবি pill's state machine, shared by the টালি and ক্যাশ forms.
 *
 * Camera or gallery pick -> downsample to a JPEG data URI -> upload through our
 * own /api/uploads (the Cloudinary secret stays on the server) -> hold the URL
 * until the form is submitted. Same flow as the customer avatar on the add/edit
 * form, lifted out so the two entry forms share one implementation instead of
 * each growing its own copy.
 */
class PhotoAttach {
    /** Cloudinary URL of the attached photo ("" when none). */
    var photoUrl by mutableStateOf("")
    var photoPublicId by mutableStateOf("")
    var uploading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var sheetVisible by mutableStateOf(false)

    /** The camera's pending scratch file; its FileProvider URI goes in the intent. */
    var pendingCameraTarget by mutableStateOf<Pair<android.net.Uri, File>?>(null)

    /** Wired by [rememberPhotoAttach] to the ActivityResult launchers. */
    var cameraLauncher by mutableStateOf<(Pair<android.net.Uri, File>) -> Unit>({})
    var galleryLauncher by mutableStateOf<() -> Unit>({})

    val hasPhoto: Boolean get() = photoUrl.isNotBlank()

    fun openSheet() {
        sheetVisible = true
    }

    fun closeSheet() {
        sheetVisible = false
    }

    fun clear() {
        photoUrl = ""
        photoPublicId = ""
        sheetVisible = false
        error = null
    }
}

/**
 * Wires [attach] to the camera/gallery launchers and performs the upload.
 * [folder] is the Cloudinary sub-folder (keeps assets namespaced by kind).
 */
@Composable
fun rememberPhotoAttach(
    store: AppStore,
    folder: String = "transactions",
    onError: (String) -> Unit = {},
): PhotoAttach {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val attach = remember { PhotoAttach() }

    val upload: (android.net.Uri, () -> Unit) -> Unit = { uri, cleanup ->
        scope.launch {
            attach.uploading = true
            attach.error = null
            val dataUri = withContext(Dispatchers.IO) { ImagePicking.toDataUri(context, uri) }
            cleanup()
            if (dataUri == null) {
                val message = "ছবিটি পড়া যায়নি, অন্য ছবি চেষ্টা করুন"
                attach.error = message
                onError(message)
                attach.uploading = false
                return@launch
            }
            store.uploadImage(dataUri, folder = folder)
                .onSuccess {
                    attach.photoUrl = it.url
                    attach.photoPublicId = it.publicId
                }
                .onFailure {
                    val message = it.message ?: "ছবি আপলোড করা যায়নি"
                    attach.error = message
                    onError(message)
                }
            attach.uploading = false
        }
    }

    val cameraLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.TakePicture(),
    ) { saved ->
        val target = attach.pendingCameraTarget
        attach.pendingCameraTarget = null
        if (saved && target != null) {
            upload(target.first) { ImagePicking.discard(target.second) }
        } else {
            ImagePicking.discard(target?.second)
        }
    }

    val galleryLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent(),
    ) { uri -> if (uri != null) upload(uri) { } }

    attach.cameraLauncher = { target ->
        attach.pendingCameraTarget = target
        cameraLauncher.launch(target.first)
    }
    attach.galleryLauncher = { galleryLauncher.launch("image/*") }

    return attach
}

/**
 * The ছবি pill: camera glyph, the photo's thumbnail once one is attached, a
 * spinner while the upload is in flight. Tapping opens the source sheet.
 */
@Composable
fun PhotoPill(
    attach: PhotoAttach,
    modifier: Modifier = Modifier,
) {
    val bitmap = rememberRemoteBitmap(attach.photoUrl.takeIf { it.isNotBlank() }, maxPx = 96)
    Row(
        modifier
            .height(34.dp)
            .clip(RoundedCornerShape(50))
            .background(TallyColors.SoftPill)
            .then(if (!attach.uploading) Modifier.clickable { attach.openSheet() } else Modifier)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape),
            )
            Spacer(Modifier.width(6.dp))
        } else {
            LineIcon(TallyIcons.Camera, TallyColors.TextPrimary, 18.dp, strokeWidth = 1.8f)
            Spacer(Modifier.width(6.dp))
        }
        Text(
            text = if (attach.uploading) "আপলোড হচ্ছে…" else "ছবি",
            fontSize = 13.sp,
            fontWeight = FontWeight.Normal,
            color = TallyColors.TextPrimary,
        )
    }
}

/** Renders [attach]'s camera/gallery/remove sheet; call at the screen root. */
@Composable
fun PhotoAttachSheet(attach: PhotoAttach) {
    if (!attach.sheetVisible) return
    val context = LocalContext.current
    PhotoSourceSheet(
        hasPhoto = attach.hasPhoto,
        onCamera = {
            attach.closeSheet()
            attach.cameraLauncher(ImagePicking.newCameraTarget(context))
        },
        onGallery = {
            attach.closeSheet()
            attach.galleryLauncher()
        },
        onRemove = { attach.clear() },
        onDismiss = { attach.closeSheet() },
    )
}
