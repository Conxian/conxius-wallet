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
        val seedBytes = generatedMnemonic.toByteArray(Charsets.UTF_8)
        try {
            val (encrypted, iv) = encrypt(seedBytes)
            persist(encrypted, iv)
            return generatedMnemonic
        } finally {
            Arrays.fill(seedBytes, 0.toByte())
        }
    }
}
