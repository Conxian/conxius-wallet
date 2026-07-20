package com.conxius.wallet

import android.app.Application
import com.conxius.wallet.database.AppDatabase
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.Web5Manager
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.repository.RoomWalletSeedProvider
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.scan.SilentPaymentScanCoordinator
import com.conxius.wallet.session.WalletSession

class ConxiusApplication : Application() {
    val strongBoxManager by lazy { StrongBoxManager(this) }
    val database by lazy { AppDatabase.getDatabase(this, strongBoxManager.getDatabasePassphrase()) }
    val walletRepository by lazy { WalletRepository(database.walletDao()) }
    val walletSession by lazy { WalletSession() }
    private val walletSeedProvider by lazy {
        RoomWalletSeedProvider(walletRepository, strongBoxManager, walletSession)
    }
    val bdkManager by lazy { BdkManager() }

    // Bridged Native Protocol Managers
    val babylonManager by lazy { BabylonManager() }
    val dlcManager by lazy { DlcManager() }
    val nwcManager by lazy { NwcManager() }
    val arkManager by lazy { ArkManager() }
    val stateChainManager by lazy { StateChainManager() }
    val mavenManager by lazy { MavenManager() }
    val liquidManager by lazy { LiquidManager() }
    val evmManager by lazy { EvmManager() }
    val lightningManager by lazy { LightningManager() }
    val breezManager by lazy { BreezManager() }
    val stacksManager by lazy { StacksManager() }
    val rgbManager by lazy { RgbManager() }
    val bitVmManager by lazy { BitVmManager() }
    val web5Manager by lazy { Web5Manager() }
    val musig2Manager by lazy { Musig2Manager() }
    val silentPaymentBlockSource by lazy { EsploraBlockSource() }
    val silentPaymentManager by lazy { SilentPaymentManager(walletSeedProvider) }
    val silentPaymentCoordinator by lazy {
        SilentPaymentScanCoordinator(
            repository = walletRepository,
            walletSession = walletSession,
            blockSource = silentPaymentBlockSource,
            silentPaymentManager = silentPaymentManager,
        )
    }
    val yieldManager by lazy { YieldManager() }
    val insuranceManager by lazy { InsuranceManager() }
    val interoperabilityManager by lazy { InteroperabilityManager() }
    val b2bManager by lazy { B2bManager() }
    val nttManager by lazy { NttManager() }

    override fun onCreate() {
        super.onCreate()
    }
}
