package com.conxius.wallet.repository

import com.conxius.wallet.bitcoin.OutPoint
import com.conxius.wallet.bitcoin.ScanRange
import com.conxius.wallet.bitcoin.SilentPaymentBatch
import com.conxius.wallet.bitcoin.SilentPaymentMatch
import com.conxius.wallet.bitcoin.SilentPaymentMatchKind
import com.conxius.wallet.bitcoin.SilentPaymentNetwork
import com.conxius.wallet.bitcoin.SilentPaymentTransaction
import com.conxius.wallet.bitcoin.TaprootOutput
import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import com.conxius.wallet.database.SilentPaymentUtxoEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SilentPaymentPersistenceMapperTest {
    @Test
    fun mapsCanonicalOutpointAndUnknownSpentnessWithoutSecretFields() {
        val transactionIdLittleEndian = ByteArray(32) { index -> (index + 1).toByte() }
        val outputKey = ByteArray(32) { 0x22 }
        val batch = SilentPaymentBatch(
            network = SilentPaymentNetwork.MAINNET,
            range = ScanRange(100, 100),
            transactions = listOf(
                SilentPaymentTransaction(
                    transactionIdLittleEndian = transactionIdLittleEndian,
                    blockHeight = 100,
                    transactionIndex = 4,
                    allInputOutpoints = listOf(OutPoint(ByteArray(32) { 0x33 }, 0)),
                    eligibleInputs = emptyList(),
                    outputs = listOf(
                        TaprootOutput(
                            outputKey = outputKey,
                            outpoint = OutPoint(transactionIdLittleEndian, 0),
                            valueSat = 21_000,
                            isUnspent = true,
                            spentnessKnown = false,
                        ),
                    ),
                ),
            ),
        )
        val match = SilentPaymentMatch(
            transactionIdLittleEndian = transactionIdLittleEndian,
            blockHeight = 100,
            transactionIndex = 4,
            outputIndex = 0,
            outputKey = outputKey,
            outpoint = OutPoint(transactionIdLittleEndian, 0),
            valueSat = 21_000,
            isUnspent = true,
            k = 0,
            kind = SilentPaymentMatchKind.Unlabeled,
            matchedNegatedOutputKey = false,
        )

        val entity = SilentPaymentPersistenceMapper.toEntity(
            network = SilentPaymentNetwork.MAINNET,
            batch = batch,
            match = match,
        )
        val public = SilentPaymentPersistenceMapper.toPublic(entity)

        assertEquals("mainnet", entity.network)
        assertEquals("201f1e1d1c1b1a191817161514131211100f0e0d0c0b0a090807060504030201:0", entity.outpoint)
        assertEquals("UNKNOWN", entity.spentState)
        assertFalse(entity.spentnessKnown)
        assertEquals(entity.outpoint, public.outpoint)
        assertEquals(21_000, public.valueSat)
        assertTrue(public.outputKeyHex.isNotEmpty())
        assertFalse(public.matchedNegatedOutputKey)
    }

    @Test
    fun cursorMappingRetainsNetworkHeightAndBlockHash() {
        val cursor = com.conxius.wallet.bitcoin.SilentPaymentCursor(
            network = SilentPaymentNetwork.TESTNET,
            lastScannedHeight = 321,
            lastScannedBlockHash = "ab".repeat(32),
        )

        val entity = SilentPaymentPersistenceMapper.toCursorEntity(cursor)
        val roundTrip = SilentPaymentPersistenceMapper.fromCursorEntity(entity)

        assertEquals(cursor.network, roundTrip.network)
        assertEquals(cursor.lastScannedHeight, roundTrip.lastScannedHeight)
        assertEquals(cursor.lastScannedBlockHash, roundTrip.lastScannedBlockHash)
    }

    @Test
    fun rejectsNonCanonicalPersistedPublicRecords() {
        val invalid = SilentPaymentUtxoEntity(
            network = "mainnet",
            outpoint = "not-an-outpoint",
            txidLittleEndianHex = "00".repeat(32),
            vout = 0,
            valueSat = 1,
            outputKeyHex = "11".repeat(32),
            blockHeight = 1,
            transactionIndex = 0,
            source = "esplora",
            spentState = "UNKNOWN",
            spentnessKnown = false,
            matchKind = "UNLABELED",
            labelIndex = null,
            matchedNegatedOutputKey = false,
            updatedAt = 1,
        )

        val error = runCatching { SilentPaymentPersistenceMapper.toPublic(invalid) }.exceptionOrNull()

        assertTrue(error is NativeSilentPaymentException)
        assertEquals(NativeErrorCode.INVALID_PUBLIC_RECORD, (error as NativeSilentPaymentException).code)
    }
}
