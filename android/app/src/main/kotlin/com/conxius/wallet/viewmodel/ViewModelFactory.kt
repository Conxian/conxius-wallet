package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.crypto.StrongBoxManager

class ViewModelFactory(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager,
    private val babylonManager: BabylonManager,
    private val dlcManager: DlcManager,
    private val nwcManager: NwcManager,
    private val arkManager: ArkManager,
    private val stateChainManager: StateChainManager,
    private val mavenManager: MavenManager
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(OnboardingViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return OnboardingViewModel(repository, bdkManager, strongBoxManager) as T
        }
        if (modelClass.isAssignableFrom(WalletViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return WalletViewModel(
                repository,
                bdkManager,
                strongBoxManager,
                babylonManager,
                dlcManager,
                nwcManager,
                arkManager,
                stateChainManager,
                mavenManager
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
