package com.workbuddy.tallyclone.ui

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.SessionStore
import kotlinx.coroutines.launch

/**
 * লগইন — mobile number + password.
 *
 * The number is the account identity: the server normalises it (০১৭…, +৮৮০…,
 * ৮৮০… and English digits all collapse to one canonical form) and returns a
 * bearer token that scopes every later request to this user's own books.
 */
@Composable
fun LoginScreen(
    store: AppStore,
    onLoggedIn: () -> Unit,
    onGoToRegister: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    // Pre-fill whoever used this device last — most people have one account.
    var phone by remember { mutableStateOf(SessionStore.lastPhone()) }
    var password by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }

    val canSubmit = phone.isNotBlank() && password.isNotBlank() && !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        store.clearError()
        scope.launch {
            val result = store.login(phone, password)
            submitting = false
            if (result.isSuccess) {
                password = ""
                onLoggedIn()
            }
        }
    }

    AuthScaffold(
        title = "লগইন করুন",
        subtitle = "আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে নিজের হিসাবে ঢুকুন।",
    ) {
        AuthField(
            value = phone,
            onValueChange = { phone = it.filter { c -> !c.isWhitespace() } },
            placeholder = "মোবাইল নম্বর",
            icon = TallyIcons.Phone,
            keyboardType = KeyboardType.Phone,
        )
        Spacer(Modifier.height(16.dp))
        AuthField(
            value = password,
            onValueChange = { password = it },
            placeholder = "পাসওয়ার্ড",
            icon = TallyIcons.Lock,
            isPassword = true,
        )

        Spacer(Modifier.height(14.dp))
        AuthError(store.error)

        Spacer(Modifier.height(22.dp))
        ConfirmButton(
            label = if (submitting) "লগইন হচ্ছে…" else "লগইন",
            enabled = canSubmit,
            onClick = { submit() },
        )

        AuthSwitchRow(
            prompt = "নতুন ব্যবহারকারী?",
            action = "রেজিস্টার করুন",
            onClick = onGoToRegister,
        )
    }
}
