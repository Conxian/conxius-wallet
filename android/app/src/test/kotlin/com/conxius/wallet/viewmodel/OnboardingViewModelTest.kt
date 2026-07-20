package com.conxius.wallet.viewmodel

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingViewModelTest {
    @Test
    fun importUsesTheSharedEncryptedPersistenceRoute() {
        val scope = testScope()
        var encryptedPlaintext: ByteArray? = null
        var persisted = false
        val service = WalletCreationService(
            generateMnemonic = { "unused" },
            encrypt = { bytes ->
                encryptedPlaintext = bytes
                Pair(byteArrayOf(1), byteArrayOf(2))
            },
            persist = { _, _ -> persisted = true },
        )

        try {
            val viewModel = OnboardingViewModel(
                walletCreationService = service,
                hasPersistedWallet = { false },
                operationScope = scope,
            )

            viewModel.importWallet("imported recovery phrase")

            assertTrue(persisted)
            assertTrue(encryptedPlaintext!!.all { it == 0.toByte() })
            assertTrue(viewModel.isWalletCreated.value)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun duplicateCreateIsRejectedAndPublishedPhraseMatchesPersistedPhrase() = runBlocking {
        val scope = testScope()
        val persistenceStarted = CompletableDeferred<Unit>()
        val releasePersistence = CompletableDeferred<Unit>()
        var persisted = false
        var generatedCount = 0
        var persistedCount = 0
        var persistedPhrase: String? = null
        val service = WalletCreationService(
            generateMnemonic = { "phrase-${++generatedCount}" },
            encrypt = { bytes ->
                persistedPhrase = bytes.copyOf().toString(Charsets.UTF_8)
                Pair(byteArrayOf(1), byteArrayOf(2))
            },
            persist = { _, _ ->
                persistedCount += 1
                persisted = true
                persistenceStarted.complete(Unit)
                releasePersistence.await()
            },
        )

        try {
            val viewModel = OnboardingViewModel(
                walletCreationService = service,
                hasPersistedWallet = { persisted },
                operationScope = scope,
            )

            viewModel.createWallet()
            persistenceStarted.await()
            assertTrue(viewModel.isCreatingWallet.value)

            viewModel.createWallet()
            assertTrue(viewModel.isCreatingWallet.value)

            releasePersistence.complete(Unit)
            while (viewModel.isCreatingWallet.value) {
                kotlinx.coroutines.yield()
            }

            assertEquals(1, generatedCount)
            assertEquals(1, persistedCount)
            assertEquals(persistedPhrase, viewModel.mnemonic.value)
            assertTrue(viewModel.isWalletCreated.value)

            viewModel.createWallet()
            assertEquals(1, generatedCount)
            assertEquals(1, persistedCount)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun creationFailureLeavesOnboardingIncompleteAndReleasesSingleFlightGuard() {
        val scope = testScope()
        var shouldFail = true
        var generatedCount = 0
        val service = WalletCreationService(
            generateMnemonic = { "phrase-${++generatedCount}" },
            encrypt = {
                if (shouldFail) {
                    throw IllegalStateException("test failure")
                }
                Pair(byteArrayOf(1), byteArrayOf(2))
            },
            persist = { _, _ -> },
        )

        try {
            val viewModel = OnboardingViewModel(
                walletCreationService = service,
                hasPersistedWallet = { false },
                operationScope = scope,
            )

            viewModel.createWallet()

            assertFalse(viewModel.isWalletCreated.value)
            assertNull(viewModel.mnemonic.value)
            assertFalse(viewModel.isCreatingWallet.value)
            assertEquals("Wallet creation failed: INTERNAL", viewModel.error.value)

            shouldFail = false
            viewModel.createWallet()

            assertTrue(viewModel.isWalletCreated.value)
            assertEquals("phrase-2", viewModel.mnemonic.value)
            assertEquals(2, generatedCount)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun existingWalletIsNotReplacedByCreate() {
        val scope = testScope()
        var persistedWalletChecks = 0
        var generated = false
        val service = WalletCreationService(
            generateMnemonic = {
                generated = true
                "replacement phrase"
            },
            encrypt = { Pair(byteArrayOf(1), byteArrayOf(2)) },
            persist = { _, _ -> },
        )

        try {
            val viewModel = OnboardingViewModel(
                walletCreationService = service,
                hasPersistedWallet = { ++persistedWalletChecks > 1 },
                operationScope = scope,
            )

            viewModel.createWallet()

            assertTrue(viewModel.isWalletCreated.value)
            assertFalse(generated)
        } finally {
            scope.cancel()
        }
    }

    private fun testScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
}
