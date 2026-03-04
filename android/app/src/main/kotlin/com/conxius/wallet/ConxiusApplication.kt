package com.conxius.wallet

import android.app.Application
import com.conxius.wallet.database.AppDatabase
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.bitcoin.BdkManager

class ConxiusApplication : Application() {
    val strongBoxManager by lazy { StrongBoxManager(this) }
    val database by lazy { AppDatabase.getDatabase(this, strongBoxManager.getDatabasePassphrase()) }
    val bdkManager by lazy { BdkManager() }

    override fun onCreate() {
        super.onCreate()
    }
}
