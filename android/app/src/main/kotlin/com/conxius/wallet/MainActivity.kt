package com.conxius.wallet

import android.os.Bundle
import android.view.WindowManager
import com.conxius.wallet.crypto.Fdc3Plugin
import com.getcapacitor.BridgeActivity

/**
 * Capacitor host for the bundled web app (`dist/`).
 *
 * Loads the web/TS layer in a WebView and registers the native boundary plugins that the
 * TypeScript layer reaches through `@capacitor/core`:
 *   - [SecureEnclavePlugin] — isAvailable / getPublicKey / signBatch / signTransaction / broadcastTransaction
 *   - [SilentPaymentPlugin] — scanForPayments
 *   - [Fdc3Plugin] — raiseIntent
 *
 * Previously a Compose launcher (`FragmentActivity`); the `@CapacitorPlugin` bridges were
 * unreachable from the TS boundary without a Capacitor host (issue #635).
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // registerPlugin mutates the Bridge.Builder; it must run before super.onCreate(),
        // which constructs the Bridge from that builder.
        registerPlugin(SecureEnclavePlugin::class.java)
        registerPlugin(SilentPaymentPlugin::class.java)
        registerPlugin(Fdc3Plugin::class.java)
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
