package com.conxius.wallet

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore

@RunWith(AndroidJUnit4::class)
class NativePluginTest {

    private lateinit var appContext: Context

    @Before
    fun setUp() {
        appContext = InstrumentationRegistry.getInstrumentation().targetContext
    }

    @Test
    fun testDeviceIntegrityPlugin() {
        val plugin = DeviceIntegrityPlugin()
        Assert.assertNotNull(plugin)
        Assert.assertEquals("com.conxius.wallet", appContext.packageName)
    }

    @Test
    fun testSecureEnclavePluginLoad() {
        val plugin = SecureEnclavePlugin()
        Assert.assertNotNull(plugin)
    }

    @Test
    @Throws(Exception::class)
    fun testKeystoreAccess() {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        Assert.assertNotNull(keyStore)
    }
}
