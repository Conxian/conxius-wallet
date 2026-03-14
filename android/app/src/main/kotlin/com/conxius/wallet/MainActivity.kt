package com.conxius.wallet

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.ui.screens.DashboardScreen
import com.conxius.wallet.ui.screens.OnboardingScreen
import com.conxius.wallet.ui.screens.SecurityScreen
import com.conxius.wallet.ui.theme.ConxiusTheme
import com.conxius.wallet.viewmodel.OnboardingViewModel
import com.conxius.wallet.viewmodel.ViewModelFactory
import com.conxius.wallet.viewmodel.WalletViewModel

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        val app = application as ConxiusApplication
        val repository = WalletRepository(app.database.walletDao())
        val factory = ViewModelFactory(
            repository,
            app.bdkManager,
            app.strongBoxManager,
            app.babylonManager,
            app.dlcManager,
            app.nwcManager,
            app.arkManager,
            app.stateChainManager,
            app.mavenManager,
            app.liquidManager,
            app.evmManager,
            app.lightningManager,
            app.breezManager,
            app.stacksManager,
            app.rgbManager,
            app.bitVmManager,
            app.web5Manager,
            app.musig2Manager,
            app.silentPaymentManager,
            app.yieldManager,
            app.insuranceManager,
            app.interoperabilityManager,
            app.b2bManager
        )

        setContent {
            ConxiusTheme {
                val onboardingViewModel: OnboardingViewModel = viewModel(factory = factory)
                val walletViewModel: WalletViewModel = viewModel(factory = factory)

                var currentScreen by remember { mutableStateOf<Screen>(Screen.Onboarding) }
                val isWalletCreated by onboardingViewModel.isWalletCreated.collectAsState()
                val isLocked by walletViewModel.isLocked.collectAsState()

                LaunchedEffect(isWalletCreated) {
                    if (isWalletCreated) {
                        currentScreen = Screen.Security
                    }
                }

                when (currentScreen) {
                    Screen.Onboarding -> {
                        OnboardingScreen(
                            viewModel = onboardingViewModel,
                            onOnboardingComplete = {
                                currentScreen = Screen.Security
                            }
                        )
                    }
                    Screen.Security -> {
                        SecurityScreen(
                            viewModel = walletViewModel,
                            onUnlockSuccess = {
                                currentScreen = Screen.Dashboard
                            }
                        )
                    }
                    Screen.Dashboard -> {
                        DashboardScreen(viewModel = walletViewModel)
                    }
                }
            }
        }
    }

    sealed class Screen {
        object Onboarding : Screen()
        object Security : Screen()
        object Dashboard : Screen()
    }
}
