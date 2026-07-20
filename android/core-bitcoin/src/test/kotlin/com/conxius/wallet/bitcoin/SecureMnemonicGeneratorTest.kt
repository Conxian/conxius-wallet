package com.conxius.wallet.bitcoin

import org.bitcoindevkit.Mnemonic
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SecureMnemonicGeneratorTest {
    @Test
    fun generatedMnemonicIsAValidTwelveWordBip39Phrase() {
        val source = FixedEntropySource(entropy(0x11))
        val generated = SecureMnemonicGenerator.generate(source)

        assertEquals(12, generated.trim().split(Regex("\\s+")).size)
        val parseFailure = runCatching {
            Mnemonic.fromString(generated).use { }
        }.exceptionOrNull()
        assertNull(parseFailure)
        assertTrue(source.lastReturned.all { it == 0.toByte() })
    }

    @Test
    fun distinctEntropyProducesDistinctMnemonics() {
        val source = FixedEntropySource(entropy(0x11), entropy(0x22))

        val first = SecureMnemonicGenerator.generate(source)
        val second = SecureMnemonicGenerator.generate(source)

        assertFalse(first == second)
    }

    @Test
    fun rejectsEntropyThatIsNot128Bits() {
        val error = runCatching {
            SecureMnemonicGenerator.generate(FixedEntropySource(ByteArray(15)))
        }.exceptionOrNull()

        assertTrue(error is IllegalArgumentException)
    }

    private fun entropy(seed: Int): ByteArray = ByteArray(16) { index -> (seed + index).toByte() }

    private class FixedEntropySource(vararg entropy: ByteArray) : MnemonicEntropySource {
        private val values = entropy.toList()
        private var index = 0
        lateinit var lastReturned: ByteArray

        override fun nextBytes(length: Int): ByteArray {
            assertEquals(16, length)
            lastReturned = values[index++].copyOf()
            return lastReturned
        }
    }
}
