package com.conxius.wallet

import android.app.Application
import com.conxius.wallet.database.AppDatabase
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.bitcoin.BdkManager
import com.conxius.wallet.bitcoin.BabylonManager
import com.conxius.wallet.bitcoin.DlcManager
import com.conxius.wallet.bitcoin.NwcManager

class ConxiusApplication : Application() {
    val strongBoxManager by lazy { StrongBoxManager(this) }
    val database by lazy { AppDatabase.getDatabase(this, strongBoxManager.getDatabasePassphrase()) }
    val bdkManager by lazy { BdkManager() }

    // New Native Protocol Managers (Bridged from TS)
    val babylonManager by lazy { BabylonManager() }
    val dlcManager by lazy { DlcManager() }
    val nwcManager by lazy { NwcManager() }

    override fun onCreate() {
        super.onCreate()
    }
}
