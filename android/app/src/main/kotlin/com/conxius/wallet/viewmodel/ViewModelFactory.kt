package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.Web5Manager

class ViewModelFactory(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager,
    private val babylonManager: BabylonManager,
    private val dlcManager: DlcManager,
    private val nwcManager: NwcManager,
    private val arkManager: ArkManager,
    private val stateChainManager: StateChainManager,
    private val mavenManager: MavenManager,
    private val liquidManager: LiquidManager,
    private val evmManager: EvmManager,
    private val lightningManager: LightningManager,
    private val breezManager: BreezManager,
    private val stacksManager: StacksManager,
    private val rgbManager: RgbManager,
    private val bitVmManager: BitVmManager,
    private val web5Manager: Web5Manager,
    private val musig2Manager: Musig2Manager,
    private val silentPaymentManager: SilentPaymentManager,
    private val yieldManager: YieldManager,
    private val insuranceManager: InsuranceManager,
    private val interoperabilityManager: InteroperabilityManager,
    private val b2bManager: B2bManager
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
                mavenManager,
                liquidManager,
                evmManager,
                lightningManager,
                breezManager,
                stacksManager,
                rgbManager,
                bitVmManager,
                web5Manager,
                musig2Manager,
                silentPaymentManager,
                yieldManager,
                insuranceManager,
                interoperabilityManager,
                b2bManager
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
