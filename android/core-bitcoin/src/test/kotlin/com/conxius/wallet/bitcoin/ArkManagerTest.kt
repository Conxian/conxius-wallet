package com.conxius.wallet.bitcoin

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ArkManagerTest {
    private val manager = ArkManager()
    private val seed = ByteArray(32) { it.toByte() }

    @Test
    fun deriveVutxoIndexIsDeterministicForSameInputs() {
        val path = "m/84'/1'/0'/0/0"

        val first = manager.deriveVutxoIndex(seed, path, 7)
        val second = manager.deriveVutxoIndex(seed, path, 7)

        assertArrayEquals(first, second)
        assertEquals(32, first.size)
    }

    @Test
    fun deriveVutxoIndexDiffersForDistinctIndicesOnLongPath() {
        val longPath = "m/84'/1'/0'/0/" + "a".repeat(96)

        val first = manager.deriveVutxoIndex(seed, longPath, 0)
        val second = manager.deriveVutxoIndex(seed, longPath, 1)

        assertFalse(first.contentEquals(second))
    }

    @Test
    fun deriveVutxoIndexDiffersForLongPathsSharingFirst32Bytes() {
        val commonPrefix = "m/84'/1'/0'/0/" + "b".repeat(80)
        val leftPath = "$commonPrefix/left"
        val rightPath = "$commonPrefix/right"

        val left = manager.deriveVutxoIndex(seed, leftPath, 3)
        val right = manager.deriveVutxoIndex(seed, rightPath, 3)

        assertFalse(left.contentEquals(right))
    }
}
