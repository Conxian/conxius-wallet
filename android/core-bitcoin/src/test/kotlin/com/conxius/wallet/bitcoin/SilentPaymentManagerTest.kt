package com.conxius.wallet.bitcoin

import java.util.concurrent.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SilentPaymentManagerTest {
    private val range = ScanRange(100, 100)
    private val outpoint = OutPoint(ByteArray(32) { 7 }, 0)
    private val batch = SilentPaymentBatch(
        network = SilentPaymentNetwork.TESTNET,
        range = range,
        transactions = listOf(
            SilentPaymentTransaction(
                blockHeight = 100,
                transactionIndex = 2,
                allInputOutpoints = listOf(outpoint),
                eligibleInputs = listOf(
                    EligibleInput(
                        outpoint = outpoint,
                        publicKey = EligiblePublicKey.XOnly(ByteArray(32) { 8 }),
                    ),
                ),
                outputs = listOf(
                    TaprootOutput(
                        outputKey = ByteArray(32) { 9 },
                        outpoint = OutPoint(ByteArray(32) { 10 }, 1),
                        valueSat = 42,
                        isUnspent = true,
                    ),
                ),
            ),
        ),
    )

    @Test
    fun codecRoundTripKeepsPublicBatchShapeAndRejectsTruncation() {
        val encoded = SilentPaymentCodec.encodeBatch(batch)
        val decoded = SilentPaymentCodec.decodeBatch(encoded)

        assertEquals(batch.network, decoded.network)
        assertEquals(batch.range, decoded.range)
        assertEquals(batch.transactions.size, decoded.transactions.size)
        assertArrayEquals(
            batch.transactions[0].outputs[0].outputKey,
            decoded.transactions[0].outputs[0].outputKey,
        )
        assertEquals(
            NativeErrorCode.INVALID_PUBLIC_BATCH,
            runCatching { SilentPaymentCodec.decodeBatch(encoded.copyOf(encoded.size - 1)) }
                .exceptionOrNull()
                ?.let { (it as SilentPaymentCodec.SilentPaymentCodecException).code },
        )
    }

    @Test
    fun managerSeparatesSecretsFromPublicBatchAndMapsStructuredResult() = runBlocking {
        val provider = FixtureProvider("abandon abandon about".encodeToByteArray(), byteArrayOf(4, 5))
        val native = RecordingNativeScanner(resultFor(batch))
        val manager = SilentPaymentManager(provider, native)

        val result = manager.scanForPayments(
            SilentPaymentNetwork.TESTNET,
            range,
            InMemoryBlockSource(listOf(batch)),
        )

        assertEquals(1, native.calls)
        assertTrue(native.publicBatch.contentEquals(SilentPaymentCodec.encodeBatch(batch)))
        assertEquals(1, result.matches.size)
        assertEquals(42, result.matches.single().valueSat)
        assertEquals(1, result.metrics.transactionCount)
        assertEquals(1, result.metrics.matchCount)
        assertTrue(native.mnemonicAfterCall.all { it == 0.toByte() })
        assertTrue(native.passphraseAfterCall?.all { it == 0.toByte() } == true)
    }

    @Test
    fun nativeErrorEnvelopeMapsToStableKotlinCode() = runBlocking {
        val provider = FixtureProvider(byteArrayOf(1), null)
        val native = object : NativeSilentPaymentScanner {
            override suspend fun scan(
                mnemonicBytes: ByteArray,
                passphraseBytes: ByteArray?,
                publicBatch: ByteArray,
            ): ByteArray = byteArrayOf('S'.code.toByte(), 'P'.code.toByte(), 'R'.code.toByte(), '1'.code.toByte(), 1, 4)
        }

        val error = runCatching {
            SilentPaymentManager(provider, native).scanBatch(batch)
        }.exceptionOrNull()

        assertTrue(error is NativeSilentPaymentException)
        assertEquals(NativeErrorCode.RESOURCE_LIMIT, (error as NativeSilentPaymentException).code)
    }

    @Test
    fun secretBuffersAreClearedWhenNativeCallIsCancelled() = runBlocking {
        val provider = FixtureProvider(byteArrayOf(2, 3), byteArrayOf(4))
        val native = object : NativeSilentPaymentScanner {
            override suspend fun scan(
                mnemonicBytes: ByteArray,
                passphraseBytes: ByteArray?,
                publicBatch: ByteArray,
            ): ByteArray {
                throw CancellationException("fixture cancellation")
            }
        }
        val manager = SilentPaymentManager(provider, native)
        val error = runCatching { manager.scanBatch(batch) }.exceptionOrNull()

        assertTrue(error is CancellationException)
        assertTrue(provider.lastMnemonic.all { it == 0.toByte() })
        assertTrue(provider.lastPassphrase?.all { it == 0.toByte() } == true)
    }

    @Test
    fun addressDerivationRemainsFailClosedAndNativeLoaderHasStableAbsenceCode() {
        val manager = SilentPaymentManager()
        val error = runCatching { manager.deriveSilentAddress(ByteArray(33), ByteArray(33)) }.exceptionOrNull()
        assertEquals(NativeErrorCode.INTERNAL, (error as NativeSilentPaymentException).code)
    }

    private fun resultFor(batch: SilentPaymentBatch): SilentPaymentScanResult =
        SilentPaymentScanResult(
            matches = listOf(
                SilentPaymentMatch(
                    blockHeight = batch.transactions[0].blockHeight,
                    transactionIndex = batch.transactions[0].transactionIndex,
                    outputIndex = 0,
                    outputKey = batch.transactions[0].outputs[0].outputKey.copyOf(),
                    outpoint = batch.transactions[0].outputs[0].outpoint,
                    valueSat = 42,
                    isUnspent = true,
                    k = 0,
                    kind = SilentPaymentMatchKind.Unlabeled,
                    matchedNegatedOutputKey = false,
                ),
            ),
            metrics = SilentPaymentMetrics(
                transactionCount = 1,
                scannedTransactionCount = 1,
                skippedTransactionCount = 0,
                matchCount = 1,
                elapsedMicros = 10,
                batchBytes = SilentPaymentCodec.encodeBatch(batch).size.toLong(),
            ),
        )

    private class FixtureProvider(
        mnemonic: ByteArray,
        passphrase: ByteArray?,
    ) : WalletSeedProvider {
        val lastMnemonic = mnemonic
        val lastPassphrase = passphrase

        override suspend fun <T> withSeed(block: suspend (WalletSeedMaterial) -> T): T =
            block(WalletSeedMaterial(lastMnemonic, lastPassphrase))
    }

    private class RecordingNativeScanner(
        private val result: SilentPaymentScanResult,
    ) : NativeSilentPaymentScanner {
        var calls = 0
        lateinit var mnemonicAfterCall: ByteArray
        var passphraseAfterCall: ByteArray? = null
        lateinit var publicBatch: ByteArray

        override suspend fun scan(
            mnemonicBytes: ByteArray,
            passphraseBytes: ByteArray?,
            publicBatch: ByteArray,
        ): ByteArray {
            calls += 1
            this.mnemonicAfterCall = mnemonicBytes
            this.passphraseAfterCall = passphraseBytes
            this.publicBatch = publicBatch.copyOf()
            return SilentPaymentCodec.encodeResult(result)
        }
    }
}
