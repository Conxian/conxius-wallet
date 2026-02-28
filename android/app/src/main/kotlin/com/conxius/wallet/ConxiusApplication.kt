package com.conxius.wallet

import android.app.Application
import com.conxius.wallet.database.AppDatabase
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.bitcoin.BdkManager

class ConxiusApplication : Application() {
    val database by lazy { AppDatabase.getDatabase(this) }
    val strongBoxManager by lazy { StrongBoxManager() }
    val bdkManager by lazy { BdkManager() }

    override fun onCreate() {
        super.onCreate()
    }
}
