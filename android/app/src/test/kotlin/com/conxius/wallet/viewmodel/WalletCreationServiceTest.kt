package com.conxius.wallet.viewmodel

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class WalletCreationServiceTest {
    @Test
    fun generationFailureDoesNotEncryptOrPersist() = runBlocking {
        var encrypted = false
        var persisted = false
        val error = runCatching {
            WalletCreationService(
                generateMnemonic = { throw IllegalStateException("generation failure") },
                encrypt = {
                    encrypted = true
                    Pair(byteArrayOf(1), byteArrayOf(2))
                },
                persist = { _, _ -> persisted = true },
            ).create()
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertFalse(encrypted)
        assertFalse(persisted)
    }

    @Test
    fun encryptsBeforePersistingAndClearsPlaintextAfterward() = runBlocking {
        val events = mutableListOf<String>()
        val generatedMnemonic = "generated recovery phrase"
        var plaintextAfterCreate: ByteArray? = null

        val service = WalletCreationService(
            generateMnemonic = { generatedMnemonic },
            encrypt = { plaintext ->
                events += "encrypt"
                plaintextAfterCreate = plaintext
                Pair(byteArrayOf(1), byteArrayOf(2))
            },
            persist = { _, _ -> events += "persist" },
        )

        val result = service.create()

        assertSame(generatedMnemonic, result)
        assertTrue(events == listOf("encrypt", "persist"))
        assertTrue(plaintextAfterCreate!!.all { it == 0.toByte() })
    }

    @Test
    fun encryptionFailureDoesNotPersistOrReturnSuccess() = runBlocking {
        var persisted = false
        val error = runCatching {
            WalletCreationService(
                generateMnemonic = { "generated recovery phrase" },
                encrypt = { throw IllegalStateException("encryption failure") },
                persist = { _, _ -> persisted = true },
            ).create()
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertFalse(persisted)
    }

    @Test
    fun persistenceFailurePropagatesWithoutPublishingSuccess() = runBlocking {
        var encrypted = false
        val error = runCatching {
            WalletCreationService(
                generateMnemonic = { "generated recovery phrase" },
                encrypt = {
                    encrypted = true
                    Pair(byteArrayOf(1), byteArrayOf(2))
                },
                persist = { _, _ -> throw IllegalStateException("persistence failure") },
            ).create()
        }.exceptionOrNull()

        assertTrue(encrypted)
        assertTrue(error is IllegalStateException)
    }
}
