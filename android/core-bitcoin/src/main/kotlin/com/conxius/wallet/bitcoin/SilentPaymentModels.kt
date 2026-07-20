package com.conxius.wallet.bitcoin

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/** Networks accepted by the versioned native protocol. */
enum class SilentPaymentNetwork(val wireCode: Int) {
    MAINNET(0),
    TESTNET(1),
    SIGNET(2),
    REGTEST(3);

    companion object {
        fun fromWireCode(code: Int): SilentPaymentNetwork =
            entries.firstOrNull { it.wireCode == code }
                ?: throw SilentPaymentCodec.SilentPaymentCodecException(NativeErrorCode.INVALID_NETWORK)
    }
}

data class ScanRange(val startBlock: Long, val endBlock: Long) {
    init {
        require(startBlock >= 0) { "scan range start must be non-negative" }
        require(endBlock >= startBlock) { "scan range end must not precede start" }
        require(safeRangeSpan(startBlock, endBlock) < MAX_SCAN_BLOCKS) {
            "scan range exceeds the maximum block bound"
        }
    }
}

/** Bitcoin outpoint in serialized byte order. The byte array is public transaction metadata. */
data class OutPoint(val txidLittleEndian: ByteArray, val vout: Long) {
    init {
        require(txidLittleEndian.size == 32) { "outpoint txid must be 32 bytes" }
        require(vout in 0..UINT32_MAX) { "outpoint vout must fit uint32" }
    }
}

sealed interface EligiblePublicKey {
    val bytes: ByteArray

    data class Compressed(override val bytes: ByteArray) : EligiblePublicKey {
        init {
            require(bytes.size == 33) { "compressed public key must be 33 bytes" }
            require(bytes[0].toInt() and 0xff in 0x02..0x03) {
                "compressed public key prefix must be 02 or 03"
            }
        }
    }

    data class XOnly(override val bytes: ByteArray) : EligiblePublicKey {
        init {
            require(bytes.size == 32) { "x-only public key must be 32 bytes" }
        }
    }
}

data class EligibleInput(val outpoint: OutPoint, val publicKey: EligiblePublicKey)

data class TaprootOutput(
    val outputKey: ByteArray,
    val outpoint: OutPoint,
    val valueSat: Long,
    val isUnspent: Boolean,
    /** True only when the source supplied authoritative spentness metadata. */
    val spentnessKnown: Boolean = false,
) {
    init {
        require(outputKey.size == 32) { "taproot output key must be 32 bytes" }
        require(valueSat in 0..MAX_MONEY_SAT) { "output value is outside Bitcoin's money range" }
    }
}

data class SilentPaymentTransaction(
    val transactionIdLittleEndian: ByteArray,
    val blockHeight: Long,
    val transactionIndex: Long,
    val allInputOutpoints: List<OutPoint>,
    val eligibleInputs: List<EligibleInput>,
    val outputs: List<TaprootOutput>,
) {
    init {
        require(transactionIdLittleEndian.size == 32) { "transaction id must be 32 bytes" }
        require(blockHeight >= 0) { "transaction block height must be non-negative" }
        require(transactionIndex in 0..UINT32_MAX) { "transaction index must fit uint32" }
    }
}

data class SilentPaymentBatch(
    val network: SilentPaymentNetwork,
    val account: Long = 0,
    val range: ScanRange,
    val labels: List<Long> = emptyList(),
    val transactions: List<SilentPaymentTransaction>,
    /** Public chain metadata used by persistence/reorg checks; not part of the SPB1 wire format. */
    val blockHeight: Long? = null,
    val blockHash: String? = null,
    val previousBlockHash: String? = null,
    val currentTipHeight: Long? = null,
    val currentTipHash: String? = null,
    /** Bounded parser diagnostics for transactions that could not be safely scanned. */
    val skippedTransactionCount: Long = 0,
    val skipReasons: List<String> = emptyList(),
    /** Native batches may split a large block; the cursor advances only on the final batch. */
    val batchTransactionOffset: Long = 0,
    val isFinalBatchForBlock: Boolean = true,
) {
    init {
        require(account == 0L) { "only account zero is supported in protocol version 2" }
        require(labels.all { it in 0..UINT32_MAX }) { "label must fit uint32" }
        require(transactions.all { it.blockHeight in range.startBlock..range.endBlock }) {
            "transaction block height must be within the supplied scan range"
        }
        require(skippedTransactionCount >= 0) { "skipped transaction count must be non-negative" }
        require(skipReasons.size <= MAX_SKIP_DIAGNOSTICS) { "too many skip diagnostics" }
        require(batchTransactionOffset >= 0) { "batch transaction offset must be non-negative" }
    }
}

sealed interface SilentPaymentMatchKind {
    data object Unlabeled : SilentPaymentMatchKind

    data class Label(val index: Long) : SilentPaymentMatchKind {
        init {
            require(index in 0..UINT32_MAX) { "label index must fit uint32" }
        }
    }
}

data class SilentPaymentMatch(
    val transactionIdLittleEndian: ByteArray,
    val blockHeight: Long,
    val transactionIndex: Long,
    val outputIndex: Long,
    val outputKey: ByteArray,
    val outpoint: OutPoint,
    val valueSat: Long,
    val isUnspent: Boolean,
    val k: Long,
    val kind: SilentPaymentMatchKind,
    val matchedNegatedOutputKey: Boolean,
) {
    init {
        require(transactionIdLittleEndian.size == 32) { "match transaction id must be 32 bytes" }
        require(outputKey.size == 32) { "match output key must be 32 bytes" }
        require(blockHeight >= 0) { "match block height must be non-negative" }
        require(transactionIndex in 0..UINT32_MAX) { "match transaction index must fit uint32" }
        require(outputIndex in 0 until SilentPaymentCodec.MAX_TAPROOT_OUTPUTS.toLong()) {
            "match output index must be below the taproot output limit"
        }
        require(k in 0 until SilentPaymentCodec.MAX_K.toLong()) {
            "match k must be below K_MAX"
        }
        require(valueSat in 0..MAX_MONEY_SAT) { "match value is outside Bitcoin's money range" }
    }
}

data class SilentPaymentMetrics(
    val transactionCount: Long,
    val scannedTransactionCount: Long,
    val skippedTransactionCount: Long,
    val matchCount: Long,
    val elapsedMicros: Long,
    val batchBytes: Long,
) {
    init {
        require(transactionCount >= 0)
        require(scannedTransactionCount >= 0)
        require(skippedTransactionCount >= 0)
        require(matchCount >= 0)
        require(elapsedMicros >= 0)
        require(batchBytes >= 0)
    }
}

data class SilentPaymentScanResult(
    val matches: List<SilentPaymentMatch>,
    val metrics: SilentPaymentMetrics,
)

/** Stable public options accepted by application/UI scan entry points. */
data class SilentPaymentScanOptions(
    val network: SilentPaymentNetwork,
    val startHeight: Long? = null,
    val endHeight: Long,
) {
    init {
        require(endHeight >= 0) { "scan end height must be non-negative" }
        require(startHeight == null || startHeight >= 0) { "scan start height must be non-negative" }
        require(startHeight == null || startHeight <= endHeight) {
            "scan start height must not exceed scan end height"
        }
        require(startHeight == null || safeRangeSpan(startHeight, endHeight) < MAX_SCAN_BLOCKS) {
            "scan range exceeds the maximum block bound"
        }
    }
}

data class SilentPaymentCursor(
    val network: SilentPaymentNetwork,
    val lastScannedHeight: Long,
    val lastScannedBlockHash: String,
) {
    init {
        require(lastScannedHeight >= 0) { "cursor height must be non-negative" }
        require(lastScannedBlockHash == lastScannedBlockHash.lowercase()) {
            "cursor block hash must be lowercase"
        }
        require(lastScannedBlockHash.matches(HEX_64)) { "cursor block hash must be 32-byte hex" }
    }
}

/** Public UTXO projection safe for persistence and JavaScript serialization. */
data class SilentPaymentPublicUtxo(
    val network: SilentPaymentNetwork,
    val outpoint: String,
    val txid: String,
    val vout: Long,
    val valueSat: Long,
    val outputKeyHex: String,
    val blockHeight: Long,
    val transactionIndex: Long,
    val source: String,
    val spentState: String,
    val spentnessKnown: Boolean,
    val matchKind: String,
    val labelIndex: Long?,
    val matchedNegatedOutputKey: Boolean,
)

data class SilentPaymentPublicMetrics(
    val scannedBlocks: Long,
    val scannedTransactions: Long,
    val skippedTransactions: Long,
    val matchCount: Long,
    val currentHeight: Long?,
    val currentTipHeight: Long?,
)

data class SilentPaymentPublicScanReport(
    val utxos: List<SilentPaymentPublicUtxo>,
    val metrics: SilentPaymentPublicMetrics,
    val cursor: SilentPaymentCursor?,
)

const val MAX_SCAN_BLOCKS: Long = 2_016
const val MAX_MONEY_SAT: Long = 2_100_000_000_000_000L
const val MAX_SKIP_DIAGNOSTICS: Int = 32
private val HEX_64 = Regex("[0-9a-f]{64}")

private fun safeRangeSpan(start: Long, end: Long): Long =
    try {
        Math.subtractExact(end, start)
    } catch (_: ArithmeticException) {
        Long.MAX_VALUE
    }

/** Supplies bounded, public transaction batches to the native scanner. */
interface BlockSource {
    fun batches(network: SilentPaymentNetwork, range: ScanRange): Flow<SilentPaymentBatch>
}

/** Deterministic fixture source used by host/unit tests only. */
class InMemoryBlockSource(private val fixtureBatches: List<SilentPaymentBatch>) : BlockSource {
    override fun batches(network: SilentPaymentNetwork, range: ScanRange): Flow<SilentPaymentBatch> = flow {
        fixtureBatches.forEach { batch ->
            currentCoroutineContext().ensureActive()
            require(batch.network == network) { "fixture network does not match scan network" }
            require(batch.range == range) { "fixture scan range does not match requested range" }
            emit(batch)
        }
    }
}

internal const val UINT32_MAX: Long = 0xffff_ffffL
