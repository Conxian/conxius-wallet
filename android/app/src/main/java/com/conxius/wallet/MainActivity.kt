package com.conxius.wallet

import android.os.Bundle
import android.view.WindowManager
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        registerPlugin(SecureEnclavePlugin::class.java)
        registerPlugin(DeviceIntegrityPlugin::class.java)
        // registerPlugin(BreezPlugin::class.java)
    }
}
