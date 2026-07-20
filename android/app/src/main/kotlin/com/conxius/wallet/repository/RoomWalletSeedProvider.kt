package com.conxius.wallet.repository

import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import com.conxius.wallet.bitcoin.WalletSeedMaterial
import com.conxius.wallet.bitcoin.WalletSeedProvider
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.session.WalletSession
import kotlinx.coroutines.CancellationException
import java.util.Arrays

/**
* Production seed boundary for silent-payment scanning.
*
* Room stores only ciphertext/IV. A decrypted mnemonic is borrowed as mutable UTF-8 bytes for a
* single callback and is wiped in this provider and again by the manager. The provider never
* converts the bytes to String, caches them, derives keys, or includes them in diagnostics.
*/
class RoomWalletSeedProvider(
    private val repository: WalletRepository,
    private val strongBoxManager: StrongBoxManager,
    private val walletSession: WalletSession,
) : WalletSeedProvider {
    override suspend fun <T> withSeed(block: suspend (WalletSeedMaterial) -> T): T {
        if (!walletSession.isUnlocked.value) {
            throw NativeSilentPaymentException(NativeErrorCode.WALLET_LOCKED)
        }

        val encryptedSeed = repository.getEncryptedSeed()
            ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_SECRET)
        var decrypted: ByteArray? = null
        try {
            val seedBytes = strongBoxManager.decryptBytes(
                encryptedData = encryptedSeed.encryptedSeed,
                iv = encryptedSeed.iv,
            )
            decrypted = seedBytes
            if (seedBytes.isEmpty() || seedBytes.size > MAX_MNEMONIC_BYTES) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_SECRET)
            }
            if (!walletSession.isUnlocked.value) {
                throw NativeSilentPaymentException(NativeErrorCode.WALLET_LOCKED)
            }
            val material = WalletSeedMaterial(seedBytes, null)
            return try {
                block(material)
            } finally {
                material.clear()
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: NativeSilentPaymentException) {
            throw error
        } catch (error: Exception) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_SECRET, error)
        } finally {
            decrypted?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    private companion object {
        const val MAX_MNEMONIC_BYTES = 512
    }
}
