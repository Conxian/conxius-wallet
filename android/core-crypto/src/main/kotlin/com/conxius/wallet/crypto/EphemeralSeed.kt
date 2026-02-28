package com.conxius.wallet.crypto

import java.util.Arrays

class EphemeralSeed(private var seed: ByteArray) {
    fun <T> use(block: (ByteArray) -> T): T {
        return try {
            block(seed)
        } finally {
            wipe()
        }
    }

    private fun wipe() {
        Arrays.fill(seed, 0.toByte())
    }
}
