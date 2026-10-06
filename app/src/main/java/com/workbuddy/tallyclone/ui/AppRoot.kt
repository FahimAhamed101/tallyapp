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
import com.workbuddy.tallyclone.data.StockDetail
import com.workbuddy.tallyclone.data.StockItem
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

    /** সাইডবার মেনু রিপোর্ট স্ক্রিনসমূহ (বেচা কেনা, খরচ, বাকি, ক্যাশ হিসাব) */
    data object SalesPurchaseReport : TallyScreen
    data object ExpenseReport : TallyScreen
    data object DueReport : TallyScreen
    data class CashAccountReport(val initialTab: Int = 0) : TallyScreen

    /** স্টক হিসাব — the product list behind the home tab's second tile. */
    data object StockList : TallyScreen

    /** নতুন পণ্য ([item] null) / পণ্য সম্পাদনা. */
    data class StockForm(val item: StockItem?, val returnTo: TallyScreen) : TallyScreen

    /** One product and its স্টক ইন / স্টক আউট history. */
    data class StockDetail(val itemId: String) : TallyScreen

    /** সেটিংস — the drawer's সেটিংস row. */
    data object Settings : TallyScreen

    /** অ্যাপ সিকিউরিটি → PIN সেট করুন / PIN পরিবর্তন করুন. */
    data object Pin : TallyScreen

    /** প্রোফাইল সেটিংস → মোবাইল নম্বর পরিবর্তন. */
    data object PhoneChange : TallyScreen

    /** ব্যবসার নোট — checklist notes. */
    data object BusinessNotes : TallyScreen

    /** মালিকের রিপোর্ট — owner's report. */
    data object OwnerReport : TallyScreen
}

/**
 * Where a drawer row leads, or null when it leads nowhere yet.
 *
 * Pulled out of the `when` in [AppRoot] because the failure this guards against
 * is invisible from a screenshot: every row rendered identically whether it was
 * wired or fell through to `else -> Unit`. সেটিংস was in exactly that state —
 * the server shipped the entry, the drawer drew it, and tapping it did nothing.
 * As a pure function the mapping can be asserted directly, which a `when` buried
 * inside a composable cannot be.
 *
 * `null` is a real answer: 'refer' has no screen yet, and saying so explicitly
 * is better than an `else -> Unit` that silently swallows every future key.
 */
internal fun menuScreenFor(key: String): TallyScreen? = when (key) {
    "ledger" -> TallyScreen.SalesPurchaseReport
    "expense" -> TallyScreen.ExpenseReport
    "due" -> TallyScreen.DueReport
    "cash" -> TallyScreen.CashAccountReport(0)
    "report" -> TallyScreen.CashAccountReport(1)
    "settings" -> TallyScreen.Settings
    "notes" -> TallyScreen.BusinessNotes
    "owner_report" -> TallyScreen.OwnerReport
    else -> null
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

    /**
     * মাল্টি ব্যবসা. Held here rather than inside HomeScreen so the sheet stays
     * put across the recomposition a business switch triggers — HomeScreen's
     * whole tree is rebuilt when the active book changes.
     */
    var showBusinesses by remember { mutableStateOf(false) }

    /**
     * স্টক হিসাব detail. Held here rather than inside the screen so the detail
     * screen stays a pure renderer — every network call in this app is issued
     * from `AppRoot` or `AppStore`, never from a composable's `LaunchedEffect`.
     */
    var stockDetail by remember { mutableStateOf<StockDetail?>(null) }
    var stockDetailLoading by remember { mutableStateOf(false) }

    /** Re-reads one product after a movement or an edit changed it. */
    val loadStockDetail: (String) -> Unit = { id ->
        stockDetailLoading = true
        scope.launch {
            store.loadStockItem(id).onSuccess { stockDetail = it }
            stockDetailLoading = false
        }
    }

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
            showBusinesses = false
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

    // Hardware back: close the drawer or the sheet first, then step back through
    // সেটিংস's two pushed screens, then pop to the home tab.
    BackHandler(enabled = showMenu || showBusinesses || screen != TallyScreen.Home) {
        when {
            showBusinesses -> showBusinesses = false
            showMenu -> showMenu = false
            screen == TallyScreen.Pin || screen == TallyScreen.PhoneChange ->
                screen = TallyScreen.Settings
            screen == TallyScreen.OwnerReport ->
                screen = TallyScreen.CashAccountReport(1)
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
                onOpenBusinesses = {
                    showBusinesses = true
                    // Another device may have added or renamed a book since the
                    // last bootstrap, so the sheet always opens on fresh data.
                    scope.launch { store.refreshBusinesses() }
                },
                onOpenStock = {
                    // A stale detail from a previous visit must not flash behind
                    // the list, so it is dropped on the way in.
                    stockDetail = null
                    screen = TallyScreen.StockList
                    scope.launch { store.refreshStock() }
                },
                onOpenNotes = {
                    screen = TallyScreen.BusinessNotes
                    scope.launch { store.refreshNotes() }
                },
            )

            TallyScreen.Cashbox -> CashboxScreen(
                store = store,
                onTabSelected = onTabSelected,
                onRowClick = { key -> CASH_FORMS[key]?.let { screen = it } },
                // Tab 0 is literally "ক্যাশবাক্স রিপোর্ট" — this screen *is* the
                // cashbox dashboard, so that is where its রিপোর্ট pill goes.
                onOpenReport = { screen = TallyScreen.CashAccountReport(0) },
            )

            TallyScreen.Wallet -> WalletScreen(store = store, onTabSelected = onTabSelected)

            is TallyScreen.Ledger -> LedgerEntryScreen(
                store = store,
                customerId = current.customerId,
                onBack = { screen = TallyScreen.Home },
                onEdit = { screen = TallyScreen.CustomerForm(it) },
                // A customer's ledger is বেচা কেনা — the same mapping the sidebar
                // menu already uses for its "ledger" entry.
                onOpenReport = { screen = TallyScreen.SalesPurchaseReport },
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
                // Tab 1 is "ক্যাশ রিপোর্ট" — this form writes cash movements, so
                // that is the report it belongs to.
                onOpenReport = { screen = TallyScreen.CashAccountReport(1) },
            )

            TallyScreen.SalesPurchaseReport -> SalesPurchaseReportScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
            )

            TallyScreen.ExpenseReport -> ExpenseReportScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
            )

            TallyScreen.DueReport -> DueReportScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
            )

            is TallyScreen.CashAccountReport -> CashAccountReportScreen(
                store = store,
                initialTab = current.initialTab,
                onBack = { screen = TallyScreen.Home },
                onOpenOwnerReport = { screen = TallyScreen.OwnerReport },
            )

            TallyScreen.StockList -> StockListScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
                onOpenItem = { id ->
                    stockDetail = null
                    screen = TallyScreen.StockDetail(id)
                    loadStockDetail(id)
                },
                onAddItem = { screen = TallyScreen.StockForm(null, TallyScreen.StockList) },
            )

            is TallyScreen.StockForm -> StockFormScreen(
                store = store,
                item = current.item,
                // Both the toolbar's back arrow and a successful save land here,
                // so editing from the detail returns to that product rather than
                // dumping the user back at the list.
                onBack = {
                    screen = current.returnTo
                    (current.returnTo as? TallyScreen.StockDetail)?.let { loadStockDetail(it.itemId) }
                },
            )

            is TallyScreen.StockDetail -> StockDetailScreen(
                store = store,
                detail = stockDetail,
                loading = stockDetailLoading,
                onBack = { screen = TallyScreen.StockList },
                onEdit = { item -> screen = TallyScreen.StockForm(item, current) },
                onReload = { loadStockDetail(current.itemId) },
            )

            TallyScreen.Settings -> SettingsScreen(
                store = store,
                settings = store.settings,
                onBack = { screen = TallyScreen.Home },
                onRetry = { scope.launch { store.refreshSettings() } },
                // One key per request: the server applies exactly what it is
                // sent, so flipping a toggle can never overwrite the other one
                // with a value this side guessed.
                onToggleDecimal = { value -> scope.launch { store.setDecimalAmount(value) } },
                onToggleSound = { value -> scope.launch { store.setNotificationSound(value) } },
                onToggleVoice = { value -> scope.launch { store.setVoiceNotification(value) } },
                onOpenPhoneChange = { screen = TallyScreen.PhoneChange },
                onOpenPin = { screen = TallyScreen.Pin },
            )

            TallyScreen.Pin -> PinScreen(
                settings = store.settings,
                onBack = { screen = TallyScreen.Settings },
                // Returning to সেটিংস on success is what makes the change
                // visible: the row's wording comes from the server's answer, so
                // staying put would leave "PIN সেট করুন" on screen after the PIN
                // had in fact been set.
                onSave = { pin ->
                    scope.launch { store.setPin(pin).onSuccess { screen = TallyScreen.Settings } }
                },
                onClear = {
                    scope.launch { store.clearPin().onSuccess { screen = TallyScreen.Settings } }
                },
            )

            TallyScreen.PhoneChange -> PhoneChangeScreen(
                currentPhone = store.profile?.phone ?: "",
                onBack = { screen = TallyScreen.Settings },
                onSave = { phone ->
                    scope.launch {
                        store.changePhone(phone).onSuccess { screen = TallyScreen.Settings }
                    }
                },
            )

            TallyScreen.BusinessNotes -> BusinessNotesScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
            )

            TallyScreen.OwnerReport -> OwnerReportScreen(
                store = store,
                onBack = { screen = TallyScreen.Home },
            )
        }

        if (showBusinesses) {
            BusinessSheet(store = store, onDismiss = { showBusinesses = false })
        }

        if (showMenu) {
            MenuDrawer(
                menu = store.menu,
                profile = store.profile,
                onDismiss = { showMenu = false },
                onLogout = {
                    showMenu = false
                    scope.launch { store.logout() }
                },
                onItemClick = { item ->
                    showMenu = false
                    menuScreenFor(item.key)?.let { target ->
                        screen = target
                        // সেটিংস is the one drawer destination whose data is not
                        // already in a bootstrap slice, so it is fetched on the
                        // way in — otherwise the screen opens on an empty state.
                        if (target == TallyScreen.Settings) scope.launch { store.refreshSettings() }
                    }
                },
            )
        }
    }
}
