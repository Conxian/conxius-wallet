package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.BdkManager
import com.conxius.wallet.bitcoin.BabylonManager
import com.conxius.wallet.bitcoin.DlcManager
import com.conxius.wallet.bitcoin.NwcManager
import com.conxius.wallet.crypto.StrongBoxManager

class ViewModelFactory(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager,
    private val babylonManager: BabylonManager,
    private val dlcManager: DlcManager,
    private val nwcManager: NwcManager
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
                nwcManager
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
