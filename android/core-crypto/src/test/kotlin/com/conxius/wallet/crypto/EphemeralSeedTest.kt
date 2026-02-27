package com.conxius.wallet.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class EphemeralSeedTest {
    @Test
    fun testSeedIsWiped() {
        val seed = byteArrayOf(1, 2, 3, 4)
        val ephemeral = EphemeralSeed(seed)

        ephemeral.use {
            assertArrayEquals(byteArrayOf(1, 2, 3, 4), it)
        }

        // After use, the original array should be zeroed
        assertArrayEquals(byteArrayOf(0, 0, 0, 0), seed)
    }
}
