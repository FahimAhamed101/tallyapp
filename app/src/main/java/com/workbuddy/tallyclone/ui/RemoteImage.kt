package com.workbuddy.tallyclone.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Tiny dependency-free image loader for the Cloudinary avatars.
 *
 * The app deliberately ships no image library (no Coil/Glide): avatars are
 * small, few, and already served as plain HTTPS URLs, so a 30-line
 * HttpURLConnection + LruCache is enough and keeps the APK lean.
 */
object AvatarCache {

    private val cache = object : LruCache<String, Bitmap>(48) {
        override fun sizeOf(key: String, value: Bitmap) = 1
    }

    /** Decodes at most [maxPx] on the long edge so a 4000px photo cannot OOM us. */
    private fun decode(bytes: ByteArray, maxPx: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > maxPx) sample *= 2
        return BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample },
        )
    }

    suspend fun load(url: String, maxPx: Int = 320): Bitmap? {
        if (url.isBlank()) return null
        cache.get(url)?.let { return it }

        val bitmap = withContext(Dispatchers.IO) {
            runCatching {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 15000
                    instanceFollowRedirects = true
                }
                try {
                    if (conn.responseCode !in 200..299) return@runCatching null
                    conn.inputStream.use { it.readBytes() }.let { decode(it, maxPx) }
                } finally {
                    conn.disconnect()
                }
            }.getOrNull()
        }

        if (bitmap != null) cache.put(url, bitmap)
        return bitmap
    }
}

/**
 * Loads a remote image once per URL and hands back the bitmap (or null while it
 * is still in flight / if it failed). Failures are silent: every caller has an
 * initials fallback, so a dead CDN must never break a screen.
 */
@Composable
fun rememberRemoteBitmap(url: String?, maxPx: Int = 320): Bitmap? {
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(url) {
        if (url.isNullOrBlank()) {
            bitmap = null
        } else {
            bitmap = AvatarCache.load(url, maxPx)
        }
    }
    return bitmap
}

/**
 * Circular avatar: the uploaded photo when there is one, otherwise the
 * initials on the server-chosen pastel background. Used everywhere a person is
 * drawn (home list, ledger toolbar, menu drawer, forms).
 */
@Composable
fun Avatar(
    photoUrl: String?,
    initials: String,
    size: Dp,
    background: Color,
    textColor: Color,
    modifier: Modifier = Modifier,
    fontSize: androidx.compose.ui.unit.TextUnit = (size.value * 0.36f).sp,
) {
    val bitmap = rememberRemoteBitmap(photoUrl, maxPx = (size.value * 3).toInt().coerceAtLeast(96))

    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(background),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Text(
                text = initials.ifBlank { "?" },
                fontSize = fontSize,
                fontWeight = FontWeight.Medium,
                color = textColor,
                maxLines = 1,
            )
        }
    }
}

/** Square-ish variant used by the add/edit form preview (still a circle). */
@Composable
fun AvatarPreview(
    photoUrl: String?,
    size: Dp = 58.dp,
    modifier: Modifier = Modifier,
) {
    val bitmap = rememberRemoteBitmap(photoUrl, maxPx = (size.value * 3).toInt().coerceAtLeast(160))
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Color(0xFFDADADA)),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            LineIcon(
                TallyIcons.Person,
                Color.White,
                size * 0.72f,
                strokeWidth = 1.6f,
            )
        }
    }
}
