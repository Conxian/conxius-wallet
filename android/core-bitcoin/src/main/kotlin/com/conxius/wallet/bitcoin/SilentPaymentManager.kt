package com.conxius.wallet.bitcoin

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/**
* Coordinates bounded structured-transaction scans.
*
* The manager never derives keys, accepts key hex strings, fabricates UTXOs, or owns chain
* ingestion. It encodes public [BlockSource] batches, borrows mnemonic material only around the
* native call, clears that material in `finally`, and aggregates public matches/metrics.
*/
class SilentPaymentManager(
    private val walletSeedProvider: WalletSeedProvider = UnavailableWalletSeedProvider,
    private val nativeScanner: NativeSilentPaymentScanner = NativeSilentPayments,
) {
    /**
     * Address derivation is intentionally fail-closed until the native address codec is added.
     * Public keys are byte arrays here; this API does not accept or return key hex strings.
     */
    @Suppress("UNUSED_PARAMETER")
    fun deriveSilentAddress(scanPublicKey: ByteArray, spendPublicKey: ByteArray): String {
        throw NativeSilentPaymentException(NativeErrorCode.INTERNAL)
    }

    /** Scan the supplied structured transaction batches for one bounded block range. */
    suspend fun scanForPayments(
        network: SilentPaymentNetwork,
        range: ScanRange,
        blockSource: BlockSource,
    ): SilentPaymentScanResult {
        val matches = ArrayList<SilentPaymentMatch>()
        var transactionCount = 0L
        var scannedTransactionCount = 0L
        var skippedTransactionCount = 0L
        var elapsedMicros = 0L
        var batchBytes = 0L

        blockSource.batches(network, range).collect { batch ->
            currentCoroutineContext().ensureActive()
            if (batch.network != network || batch.range != range) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_BATCH)
            }
            val encodedBatch = try {
                SilentPaymentCodec.encodeBatch(batch)
            } catch (error: SilentPaymentCodec.SilentPaymentCodecException) {
                throw NativeSilentPaymentException(error.code, error)
            }

            // The provider owns acquisition. The manager owns clearing the borrowed buffers after
            // the native seam returns, including cancellation and native-error paths.
            val encodedResult = walletSeedProvider.withSeed { material ->
                try {
                    currentCoroutineContext().ensureActive()
                    nativeScanner.scan(material.mnemonicBytes, material.passphraseBytes, encodedBatch)
                } finally {
                    material.clear()
                }
            }

            currentCoroutineContext().ensureActive()
            val result = try {
                SilentPaymentCodec.decodeResult(encodedResult)
            } catch (error: SilentPaymentCodec.SilentPaymentCodecException) {
                throw NativeSilentPaymentException(error.code, error)
            }
            validateBatchResult(batch, encodedBatch.size, result)
            if (result.matches.size > SilentPaymentCodec.MAX_MATCHES - matches.size) {
                throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
            }
            matches.ensureCapacity(matches.size + result.matches.size)
            matches += result.matches
            transactionCount = transactionCount.safeAdd(result.metrics.transactionCount)
            scannedTransactionCount = scannedTransactionCount.safeAdd(result.metrics.scannedTransactionCount)
            skippedTransactionCount = skippedTransactionCount.safeAdd(result.metrics.skippedTransactionCount)
            elapsedMicros = elapsedMicros.safeAdd(result.metrics.elapsedMicros)
            batchBytes = batchBytes.safeAdd(result.metrics.batchBytes)
        }

        return SilentPaymentScanResult(
            matches = matches,
            metrics = SilentPaymentMetrics(
                transactionCount = transactionCount,
                scannedTransactionCount = scannedTransactionCount,
                skippedTransactionCount = skippedTransactionCount,
                matchCount = matches.size.toLong(),
                elapsedMicros = elapsedMicros,
                batchBytes = batchBytes,
            ),
        )
    }

    suspend fun scanBatch(batch: SilentPaymentBatch): SilentPaymentScanResult =
        scanForPayments(batch.network, batch.range, InMemoryBlockSource(listOf(batch)))

    private fun validateBatchResult(
        batch: SilentPaymentBatch,
        encodedBatchSize: Int,
        result: SilentPaymentScanResult,
    ) {
        val metrics = result.metrics
        if (metrics.transactionCount != batch.transactions.size.toLong()
            || metrics.batchBytes != encodedBatchSize.toLong()
            || metrics.scannedTransactionCount + metrics.skippedTransactionCount != metrics.transactionCount
        ) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_BATCH)
        }

        result.matches.forEach { match ->
            val transaction = batch.transactions.firstOrNull {
                it.blockHeight == match.blockHeight && it.transactionIndex == match.transactionIndex
            } ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            if (match.outputIndex > Int.MAX_VALUE) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
            val output = transaction.outputs.getOrNull(match.outputIndex.toInt())
                ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            if (!output.outputKey.contentEquals(match.outputKey)
                || !sameOutPoint(output.outpoint, match.outpoint)
                || output.valueSat != match.valueSat
                || output.isUnspent != match.isUnspent
            ) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
            if (match.kind is SilentPaymentMatchKind.Label
                && match.kind.index !in batch.labels
            ) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
        }
    }

    private fun sameOutPoint(left: OutPoint, right: OutPoint): Boolean =
        left.vout == right.vout && left.txidLittleEndian.contentEquals(right.txidLittleEndian)

    private fun Long.safeAdd(value: Long): Long =
        try {
            Math.addExact(this, value)
        } catch (_: ArithmeticException) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
}
