package com.conxius.wallet.viewmodel

import java.util.Arrays

/**
* Coordinates wallet creation so plaintext is encrypted before the repository is touched.
*
* The repository implementation persists the encrypted record transactionally. The service does
* not publish a successful mnemonic until encryption and persistence both return successfully.
*/
internal class WalletCreationService(
    private val generateMnemonic: () -> String,
    private val encrypt: (ByteArray) -> Pair<ByteArray, ByteArray>,
    private val persist: suspend (ByteArray, ByteArray) -> Unit,
) {
    suspend fun create(): String {
        val generatedMnemonic = generateMnemonic()
        persistMnemonic(generatedMnemonic)
        return generatedMnemonic
    }

    /**
     * Encrypts and persists a caller-provided mnemonic through the same route as new wallet
     * creation. The displayed mnemonic remains a String because onboarding must show it to the
     * user; the temporary UTF-8 buffer is cleared after encryption and persistence.
     */
    suspend fun persistMnemonic(mnemonic: String) {
        val seedBytes = mnemonic.toByteArray(Charsets.UTF_8)
        try {
            val (encrypted, iv) = encrypt(seedBytes)
            persist(encrypted, iv)
        } finally {
            Arrays.fill(seedBytes, 0.toByte())
        }
    }
}
