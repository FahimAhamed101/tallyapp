package com.workbuddy.tallyclone

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.workbuddy.tallyclone.data.SessionStore
import com.workbuddy.tallyclone.ui.AppRoot

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Restore the stored bearer token before any composable can fire a
        // request, so a returning user lands straight in their own books.
        SessionStore.init(this)

        // Draw behind the status and navigation bars so the gold gradient
        // reaches the very top of the screen, exactly like the reference app.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        setContent {
            AppRoot()
        }
    }
}
