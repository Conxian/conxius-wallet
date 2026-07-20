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
) {
    init {
        require(outputKey.size == 32) { "taproot output key must be 32 bytes" }
        require(valueSat >= 0) { "output value must be non-negative" }
    }
}

data class SilentPaymentTransaction(
    val blockHeight: Long,
    val transactionIndex: Long,
    val allInputOutpoints: List<OutPoint>,
    val eligibleInputs: List<EligibleInput>,
    val outputs: List<TaprootOutput>,
) {
    init {
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
) {
    init {
        require(account == 0L) { "only account zero is supported in protocol version 1" }
        require(labels.all { it in 0..UINT32_MAX }) { "label must fit uint32" }
        require(transactions.all { it.blockHeight in range.startBlock..range.endBlock }) {
            "transaction block height must be within the supplied scan range"
        }
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
        require(outputKey.size == 32) { "match output key must be 32 bytes" }
        require(blockHeight >= 0) { "match block height must be non-negative" }
        require(transactionIndex in 0..UINT32_MAX) { "match transaction index must fit uint32" }
        require(outputIndex in 0..UINT32_MAX) { "match output index must fit uint32" }
        require(k in 0..UINT32_MAX) { "match k must fit uint32" }
        require(valueSat >= 0) { "match value must be non-negative" }
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

/**
* Supplies already-parsed public transactions. This phase does not define chain ingestion,
* Esplora pagination, persistence, or reorg handling.
*/
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
