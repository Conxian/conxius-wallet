package com.conxius.wallet

import android.app.Application
import com.conxius.wallet.database.AppDatabase
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.Web5Manager
import com.conxius.wallet.bitcoin.*

class ConxiusApplication : Application() {
    val strongBoxManager by lazy { StrongBoxManager(this) }
    val database by lazy { AppDatabase.getDatabase(this, strongBoxManager.getDatabasePassphrase()) }
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
    val silentPaymentManager by lazy { SilentPaymentManager() }
    val yieldManager by lazy { YieldManager() }
    val insuranceManager by lazy { InsuranceManager() }
    val interoperabilityManager by lazy { InteroperabilityManager() }
    val b2bManager by lazy { B2bManager() }

    override fun onCreate() {
        super.onCreate()
    }
}
