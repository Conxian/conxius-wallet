package com.conxius.wallet

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.conxius.wallet.ui.theme.ConxiusTheme
import com.conxius.wallet.ui.screens.OnboardingScreen
import com.conxius.wallet.ui.screens.DashboardScreen
import com.conxius.wallet.ui.screens.SecurityScreen
import com.conxius.wallet.viewmodel.OnboardingViewModel
import com.conxius.wallet.viewmodel.WalletViewModel
import com.conxius.wallet.viewmodel.ViewModelFactory
import com.conxius.wallet.repository.WalletRepository

class MainActivity : ComponentActivity() {
    companion object {
        init {
            System.loadLibrary("conxius_core")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        val app = application as ConxiusApplication
        val repository = WalletRepository(app.database.walletDao())
        val factory = ViewModelFactory(repository, app.bdkManager, app.strongBoxManager)

        setContent {
            ConxiusTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    // Determine start destination based on seed existence
                    var startDestination by remember { mutableStateOf<String?>(null) }

                    LaunchedEffect(Unit) {
                        val seed = repository.getEncryptedSeed()
                        startDestination = if (seed == null) "onboarding" else "security"
                    }

                    if (startDestination != null) {
                        NavHost(navController = navController, startDestination = startDestination!!) {
                            composable("onboarding") {
                                val viewModel: OnboardingViewModel by viewModels { factory }
                                OnboardingScreen(viewModel, onOnboardingComplete = {
                                    navController.navigate("dashboard") {
                                        popUpTo("onboarding") { inclusive = true }
                                    }
                                })
                            }
                            composable("security") {
                                val viewModel: WalletViewModel by viewModels { factory }
                                SecurityScreen(viewModel, onUnlockSuccess = {
                                    navController.navigate("dashboard") {
                                        popUpTo("security") { inclusive = true }
                                    }
                                })
                            }
                            composable("dashboard") {
                                val viewModel: WalletViewModel by viewModels { factory }
                                DashboardScreen(viewModel)
                            }
                        }
                    }
                }
            }
        }
    }
}
