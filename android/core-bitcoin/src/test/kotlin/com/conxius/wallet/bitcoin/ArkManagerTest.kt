package com.conxius.wallet.bitcoin

import org.junit.Test

class ArkManagerTest {
    private val manager = ArkManager()
    private val seed = ByteArray(32) { it.toByte() }

    @Test(expected = UnsupportedOperationException::class)
    fun deriveVutxoIndexIsDeterministicForSameInputs() {
        val path = "m/84'/1'/0'/0/0"

        manager.deriveVutxoIndex(seed, path, 7)
    }

    @Test(expected = UnsupportedOperationException::class)
    fun deriveVutxoIndexDiffersForDistinctIndicesOnLongPath() {
        val longPath = "m/84'/1'/0'/0/" + "a".repeat(96)

        manager.deriveVutxoIndex(seed, longPath, 0)
    }

    @Test(expected = UnsupportedOperationException::class)
    fun deriveVutxoIndexDiffersForLongPathsSharingFirst32Bytes() {
        val commonPrefix = "m/84'/1'/0'/0/" + "b".repeat(80)
        val leftPath = "$commonPrefix/left"

        manager.deriveVutxoIndex(seed, leftPath, 3)
    }
}
