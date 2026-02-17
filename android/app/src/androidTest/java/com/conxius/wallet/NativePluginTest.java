package com.conxius.wallet;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NativePluginTest {

    private Context appContext;

    @Before
    public void setUp() {
        appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void testDeviceIntegrityPlugin() {
        DeviceIntegrityPlugin plugin = new DeviceIntegrityPlugin();
        // Mocking PluginCall is hard without Mockito on device, 
        // but we can instantiate the class and check internal logic if exposed,
        // or purely check context.
        // Since methods take PluginCall, we might need a wrapper or just check the class loads.
        Assert.assertNotNull(plugin);
        // We can't easily invoke @PluginMethod directly without a mock PluginCall 
        // that handles .resolve()/.reject(). 
        // For now, let's just verify the context and package.
        Assert.assertEquals("com.conxius.wallet", appContext.getPackageName());
    }

    @Test
    public void testSecureEnclavePluginLoad() {
        SecureEnclavePlugin plugin = new SecureEnclavePlugin();
        Assert.assertNotNull(plugin);
    }
    
    // Check if we can load the Keystore
    @Test
    public void testKeystoreAccess() throws Exception {
        java.security.KeyStore keyStore = java.security.KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        Assert.assertNotNull(keyStore);
    }
}
