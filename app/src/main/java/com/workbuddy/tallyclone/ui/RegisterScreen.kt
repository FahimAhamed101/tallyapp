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
import kotlinx.coroutines.launch

/**
 * রেজিস্টার — name + mobile number + password.
 *
 * Registering also provisions this account's own খাতা (profile + wallet) on the
 * server, so the very first screen after sign-up is already their own empty
 * book rather than somebody else's data.
 */
@Composable
fun RegisterScreen(
    store: AppStore,
    onRegistered: () -> Unit,
    onGoToLogin: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }

    val mismatch = confirm.isNotEmpty() && password != confirm
    val canSubmit = name.isNotBlank() &&
        phone.isNotBlank() &&
        password.length >= 6 &&
        password == confirm &&
        !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        store.clearError()
        scope.launch {
            val result = store.register(name, phone, password)
            submitting = false
            if (result.isSuccess) {
                password = ""
                confirm = ""
                onRegistered()
            }
        }
    }

    AuthScaffold(
        title = "রেজিস্টার করুন",
        subtitle = "মোবাইল নম্বর দিয়ে নতুন হিসাব খুলুন — আপনার খাতা আলাদা থাকবে।",
        onBack = onGoToLogin,
    ) {
        AuthField(
            value = name,
            onValueChange = { name = it },
            placeholder = "আপনার নাম",
            icon = TallyIcons.Person,
        )
        Spacer(Modifier.height(16.dp))
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
            placeholder = "পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)",
            icon = TallyIcons.Lock,
            isPassword = true,
        )
        Spacer(Modifier.height(16.dp))
        AuthField(
            value = confirm,
            onValueChange = { confirm = it },
            placeholder = "পাসওয়ার্ড আবার লিখুন",
            icon = TallyIcons.Lock,
            isPassword = true,
        )

        Spacer(Modifier.height(14.dp))
        AuthError(if (mismatch) "দুইবার লেখা পাসওয়ার্ড মিলছে না" else store.error)

        Spacer(Modifier.height(22.dp))
        ConfirmButton(
            label = if (submitting) "হিসাব খোলা হচ্ছে…" else "রেজিস্টার করুন",
            enabled = canSubmit,
            onClick = { submit() },
        )

        AuthSwitchRow(
            prompt = "আগেই হিসাব আছে?",
            action = "লগইন করুন",
            onClick = onGoToLogin,
        )
    }
}
