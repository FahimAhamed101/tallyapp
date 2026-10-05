package com.workbuddy.tallyclone.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Turns a camera shot or a gallery pick into a `data:image/jpeg;base64,…`
 * string that [ApiClient] can post to /api/uploads.
 *
 * Both sources are normalised the same way — downsampled to at most
 * [MAX_DIM] px on the long edge, rotated upright using the EXIF tag, and
 * re-encoded as JPEG. That keeps a 12 MP phone photo comfortably inside the
 * server's 8 MB limit without shipping an image library.
 */
object ImagePicking {

    /** Long-edge cap. Avatars never need more than this on any phone. */
    private const val MAX_DIM = 1024
    private const val JPEG_QUALITY = 85

    private const val AUTHORITY_SUFFIX = ".fileprovider"

    /** Where TakePicture writes the shot; must be shared through FileProvider. */
    private fun cameraDir(context: Context): File =
        File(context.cacheDir, "camera").apply { if (!exists()) mkdirs() }

    /**
     * A fresh, empty destination for the camera app plus the content:// URI to
     * hand it. Keep both: the URI goes in the intent, the file is what we read
     * back afterwards.
     */
    fun newCameraTarget(context: Context): Pair<Uri, File> {
        val file = File(cameraDir(context), "shot_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + AUTHORITY_SUFFIX,
            file,
        )
        return uri to file
    }

    /** Deletes the scratch file once it has been read (or abandoned). */
    fun discard(file: File?) {
        runCatching { file?.takeIf { it.exists() }?.delete() }
    }

    /**
     * Reads [uri], downsamples it, rotates it upright and returns a JPEG data
     * URI. Returns null when the image cannot be decoded (e.g. the user picked
     * something that is not really an image).
     */
    fun toDataUri(context: Context, uri: Uri): String? {
        val bytes = runCatching {
            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        }.getOrNull() ?: return null
        if (bytes.isEmpty()) return null

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_DIM) sample *= 2

        val decoded = BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample },
        ) ?: return null

        val upright = applyExifRotation(decoded, readOrientation(context, uri))

        val out = ByteArrayOutputStream()
        upright.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        if (upright !== decoded) upright.recycle()

        val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    private fun readOrientation(context: Context, uri: Uri): Int = runCatching {
        context.contentResolver.openInputStream(uri)?.use { input ->
            ExifInterface(input).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
        } ?: ExifInterface.ORIENTATION_NORMAL
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

    private fun applyExifRotation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            else -> return bitmap
        }
        return runCatching {
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        }.getOrDefault(bitmap)
    }
}
