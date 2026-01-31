package com.conxius.wallet

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    init {
        System.loadLibrary("conxius_core")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(SecureEnclavePlugin::class.java)
    }
}
