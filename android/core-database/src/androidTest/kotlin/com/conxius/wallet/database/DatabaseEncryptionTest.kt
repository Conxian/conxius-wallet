package com.conxius.wallet.database

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import java.security.SecureRandom

@RunWith(AndroidJUnit4::class)
class DatabaseEncryptionTest {

    @Test
    fun testDatabaseInitializationWithEncryption() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val passphrase = ByteArray(32)
        SecureRandom().nextBytes(passphrase)

        val db = AppDatabase.getDatabase(context, passphrase)
        assertNotNull(db)
        assertNotNull(db.walletDao())
        db.close()
    }
}
