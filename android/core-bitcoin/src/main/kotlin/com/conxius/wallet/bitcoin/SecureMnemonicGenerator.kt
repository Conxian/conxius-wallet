package com.conxius.wallet.bitcoin

import java.security.SecureRandom
import java.util.Arrays
import org.bitcoindevkit.Mnemonic

/** Supplies cryptographically secure entropy to the BDK BIP-39 implementation. */
fun interface MnemonicEntropySource {
    fun nextBytes(length: Int): ByteArray
}

/**
* Generates a fresh 12-word BIP-39 mnemonic for wallet creation.
*
* BDK validates the entropy size, adds the BIP-39 checksum, and owns the phrase conversion. The
* entropy source is injectable only to make the security contract testable without making the
* production path deterministic.
*/
object SecureMnemonicGenerator {
    private const val ENTROPY_BYTES = 16
    private val secureRandom = SecureRandom()
    private val productionEntropySource = MnemonicEntropySource { length ->
        ByteArray(length).also { secureRandom.nextBytes(it) }
    }

    fun generate(entropySource: MnemonicEntropySource = productionEntropySource): String {
        val entropy = entropySource.nextBytes(ENTROPY_BYTES)
        try {
            require(entropy.size == ENTROPY_BYTES) {
                "Mnemonic entropy must contain exactly $ENTROPY_BYTES bytes"
            }
            return Mnemonic.fromEntropy(entropy).use { it.toString() }
        } finally {
            Arrays.fill(entropy, 0.toByte())
        }
    }
}
