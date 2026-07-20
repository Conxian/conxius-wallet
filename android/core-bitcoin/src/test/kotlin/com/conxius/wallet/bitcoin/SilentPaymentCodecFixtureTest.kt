package com.conxius.wallet.bitcoin

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SilentPaymentCodecFixtureTest {
    @Test
    fun checkedInRustFixtureRoundTripsByteForByte() {
        val fixture = javaClass.getResourceAsStream("/silent-payments-codec-fixtures.json")
            ?.bufferedReader()
            ?.use { it.readText() }
            ?: error("missing codec fixture resource")
        val batchHex = Regex("\\\"batch_hex\\\"\\s*:\\s*\\\"([0-9a-f]+)\\\"")
            .find(fixture)
            ?.groupValues
            ?.get(1)
            ?: error("missing batch fixture")
        val resultHex = Regex("\\\"result_hex\\\"\\s*:\\s*\\\"([0-9a-f]+)\\\"")
            .find(fixture)
            ?.groupValues
            ?.get(1)
            ?: error("missing result fixture")

        val batchBytes = batchHex.decodeHex()
        val resultBytes = resultHex.decodeHex()
        val batch = SilentPaymentCodec.decodeBatch(batchBytes)
        val result = SilentPaymentCodec.decodeResult(resultBytes)

        assertArrayEquals(batchBytes, SilentPaymentCodec.encodeBatch(batch))
        assertArrayEquals(resultBytes, SilentPaymentCodec.encodeResult(result))
    }

    @Test
    fun malformedResultReferencesFailClosed() {
        val fixture = javaClass.getResourceAsStream("/silent-payments-codec-fixtures.json")
            ?.bufferedReader()
            ?.use { it.readText() }
            ?: error("missing codec fixture resource")
        val resultHex = Regex("\\\"result_hex\\\"\\s*:\\s*\\\"([0-9a-f]+)\\\"")
            .find(fixture)
            ?.groupValues
            ?.get(1)
            ?: error("missing result fixture")
        val result = resultHex.decodeHex()

        val duplicate = (result + result.copyOfRange(38, result.size)).also { bytes ->
            putU32(bytes, 18, 2)
            putU32(bytes, 34, 2)
        }
        val duplicateError = runCatching { SilentPaymentCodec.decodeResult(duplicate) }.exceptionOrNull()
        assertTrue(duplicateError is SilentPaymentCodec.SilentPaymentCodecException)
        assertEquals(
            NativeErrorCode.INVALID_PUBLIC_RECORD,
            (duplicateError as SilentPaymentCodec.SilentPaymentCodecException).code,
        )

        val invalidK = result.copyOf().also { bytes -> putU32(bytes, 163, SilentPaymentCodec.MAX_K) }
        val invalidKError = runCatching { SilentPaymentCodec.decodeResult(invalidK) }.exceptionOrNull()
        assertTrue(invalidKError is SilentPaymentCodec.SilentPaymentCodecException)
        assertEquals(
            NativeErrorCode.INVALID_PUBLIC_RECORD,
            (invalidKError as SilentPaymentCodec.SilentPaymentCodecException).code,
        )
    }

    private fun putU32(bytes: ByteArray, offset: Int, value: Int) {
        repeat(4) { shift -> bytes[offset + shift] = (value ushr (shift * 8)).toByte() }
    }

    private fun String.decodeHex(): ByteArray {
        require(length % 2 == 0)
        return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
}
