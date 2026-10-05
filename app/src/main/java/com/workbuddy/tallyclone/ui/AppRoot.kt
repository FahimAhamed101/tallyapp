package com.workbuddy.tallyclone.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.workbuddy.tallyclone.data.ApiClient
import com.workbuddy.tallyclone.data.AppStore
import com.workbuddy.tallyclone.data.CustomerItem
import kotlinx.coroutines.launch

/**
 * Tiny hand-rolled navigation graph. The reference app keeps its four tabs in
 * one activity and pushes forms as separate screens, which is what we mirror
 * here with a single mutable state value.
 */
sealed interface TallyScreen {
    data object Home : TallyScreen
    data object Cashbox : TallyScreen
    data object Wallet : TallyScreen
    data class Ledger(val customerId: String) : TallyScreen

    /** নতুন কাস্টমার/সাপ্লায়ার — [customer] is null when creating. */
    data class CustomerForm(val customer: CustomerItem?) : TallyScreen

    /** ক্যাশ বেচা / ক্যাশ কেনা / খরচ / মালিক দিল / মালিক নিল */
    data class CashForm(
        val kind: String,
        val title: String,
        val amountLabel: String,
    ) : TallyScreen
}

private val CASH_FORMS = mapOf(
    "cash_sale" to TallyScreen.CashForm("cash_sale", "ক্যাশ বেচা", "পেলাম"),
    "cash_purchase" to TallyScreen.CashForm("cash_purchase", "ক্যাশ কেনা", "দিলাম"),
    "expense" to TallyScreen.CashForm("expense", "খরচ", "টাকার পরিমাণ"),
    "owner_in" to TallyScreen.CashForm("owner_in", "মালিক দিল", "টাকার পরিমাণ"),
    "owner_out" to TallyScreen.CashForm("owner_out", "মালিক নিল", "টাকার পরিমাণ"),
)

@Composable
fun AppRoot() {
    val store = remember { AppStore() }
    val scope = rememberCoroutineScope()

    var screen by remember { mutableStateOf<TallyScreen>(TallyScreen.Home) }
    var showMenu by remember { mutableStateOf(false) }
    var showRegister by remember { mutableStateOf(false) }

    // Cold start: if a token was stored, confirm it with the server.
    LaunchedEffect(Unit) { store.restoreSession() }

    // A 401 anywhere in the app drops the dead token and returns us to login.
    DisposableEffect(Unit) {
        ApiClient.onUnauthorized = { scope.launch { store.onTokenRejected() } }
        onDispose { ApiClient.onUnauthorized = null }
    }

    // Whenever an account signs in, start from a clean home tab and load it.
    LaunchedEffect(store.isLoggedIn) {
        if (store.isLoggedIn) {
            screen = TallyScreen.Home
            showMenu = false
            store.bootstrap()
        }
    }

    if (store.authChecking) {
        BootOverlay(label = "সেশন যাচাই হচ্ছে…")
        return
    }

    // ---- signed out -------------------------------------------------------
    if (!store.isLoggedIn) {
        if (showRegister) {
            RegisterScreen(
                store = store,
                onRegistered = { showRegister = false },
                onGoToLogin = { showRegister = false },
            )
        } else {
            LoginScreen(
                store = store,
                onLoggedIn = { showRegister = false },
                onGoToRegister = { showRegister = true },
            )
        }
        return
    }

    // ---- signed in --------------------------------------------------------
    if (store.loading && store.profile == null) {
        BootOverlay()
        return
    }

    // Hardware back: close the drawer first, then pop back to the home tab.
    BackHandler(enabled = showMenu || screen != TallyScreen.Home) {
        when {
            showMenu -> showMenu = false
            else -> screen = TallyScreen.Home
        }
    }

    val onTabSelected: (Int) -> Unit = { index ->
        when (index) {
            TAB_HOME -> {
                showMenu = false
                screen = TallyScreen.Home
            }
            TAB_CASHBOX -> {
                showMenu = false
                screen = TallyScreen.Cashbox
                scope.launch { store.refreshCashbox() }
            }
            TAB_WALLET -> {
                showMenu = false
                screen = TallyScreen.Wallet
            }
            TAB_MENU -> {
                showMenu = true
                scope.launch { store.refreshMenu() }
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        when (val current = screen) {
            TallyScreen.Home -> HomeScreen(
                store = store,
                onTabSelected = onTabSelected,
                onCustomerClick = { screen = TallyScreen.Ledger(it.id) },
                onAddCustomer = { screen = TallyScreen.CustomerForm(null) },
                onEditCustomer = { screen = TallyScreen.CustomerForm(it) },
            )

            TallyScreen.Cashbox -> CashboxScreen(
                store = store,
                onTabSelected = onTabSelected,
                onRowClick = { key -> CASH_FORMS[key]?.let { screen = it } },
            )

            TallyScreen.Wallet -> WalletScreen(store = store, onTabSelected = onTabSelected)

            is TallyScreen.Ledger -> LedgerEntryScreen(
                store = store,
                customerId = current.customerId,
                onBack = { screen = TallyScreen.Home },
                onEdit = { screen = TallyScreen.CustomerForm(it) },
            )

            is TallyScreen.CustomerForm -> AddCustomerScreen(
                store = store,
                customer = current.customer,
                onBack = { screen = TallyScreen.Home },
            )

            is TallyScreen.CashForm -> CashSellScreen(
                store = store,
                onBack = { screen = TallyScreen.Cashbox },
                kind = current.kind,
                title = current.title,
                amountLabel = current.amountLabel,
            )
        }

        if (showMenu) {
            MenuDrawer(
                store = store,
                onDismiss = { showMenu = false },
                onLogout = {
                    showMenu = false
                    scope.launch { store.logout() }
                },
                onItemClick = { item ->
                    showMenu = false
                    when (item.key) {
                        "ledger" -> screen = TallyScreen.Home
                        "due" -> screen = TallyScreen.Home
                        "cash" -> {
                            screen = TallyScreen.Cashbox
                            scope.launch { store.refreshCashbox() }
                        }
                        "expense" -> screen = CASH_FORMS.getValue("expense")
                        "report" -> screen = TallyScreen.Home
                        else -> Unit
                    }
                },
            )
        }
    }
}
