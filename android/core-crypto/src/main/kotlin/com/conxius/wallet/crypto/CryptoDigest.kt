package com.conxius.wallet.crypto

import java.security.MessageDigest

internal object CryptoDigest {
    private val hexChars = "0123456789abcdef".toCharArray()

    fun sha256(value: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(value)

    fun sha256Hex(value: ByteArray): String {
        val digest = sha256(value)
        return buildString(digest.size * 2) {
            digest.forEach { byte ->
                val unsigned = byte.toInt() and 0xff
                append(hexChars[unsigned ushr 4])
                append(hexChars[unsigned and 0x0f])
            }
        }
    }
}
