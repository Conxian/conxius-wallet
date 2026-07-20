package com.conxius.wallet.scan

import com.conxius.wallet.bitcoin.BlockSource
import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import com.conxius.wallet.bitcoin.ScanRange
import com.conxius.wallet.bitcoin.SilentPaymentBatch
import com.conxius.wallet.bitcoin.SilentPaymentCursor
import com.conxius.wallet.bitcoin.SilentPaymentManager
import com.conxius.wallet.bitcoin.SilentPaymentNetwork
import com.conxius.wallet.bitcoin.SilentPaymentPublicMetrics
import com.conxius.wallet.bitcoin.SilentPaymentPublicScanReport
import com.conxius.wallet.bitcoin.SilentPaymentScanOptions
import com.conxius.wallet.repository.SilentPaymentPersistenceMapper
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.session.WalletSession
import com.conxius.wallet.database.SilentPaymentUtxoEntity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface SilentPaymentScanState {
    data object Idle : SilentPaymentScanState

    data class Scanning(val progress: SilentPaymentScanProgress) : SilentPaymentScanState

    data class Completed(val report: SilentPaymentPublicScanReport) : SilentPaymentScanState

    data class Failed(val code: NativeErrorCode) : SilentPaymentScanState

    data object Cancelled : SilentPaymentScanState
}

data class SilentPaymentScanProgress(
    val startHeight: Long,
    val endHeight: Long,
    val currentHeight: Long?,
    val scannedBlocks: Long,
    val scannedTransactions: Long,
    val skippedTransactions: Long,
    val matchCount: Long,
    val currentTipHeight: Long?,
)

/**
* The only owner of the production source, manager, cursor/resume policy, cancellation, and
* public scan state. Secrets never enter this class; the manager obtains them through its provider.
*/
class SilentPaymentScanCoordinator(
    private val repository: WalletRepository,
    private val walletSession: WalletSession,
    private val blockSource: BlockSource,
    private val silentPaymentManager: SilentPaymentManager,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) {
    private val scanMutex = Mutex()
    private val _state = MutableStateFlow<SilentPaymentScanState>(SilentPaymentScanState.Idle)
    private var activeJob: Job? = null

    val state: StateFlow<SilentPaymentScanState> = _state.asStateFlow()

    @Synchronized
    fun start(options: SilentPaymentScanOptions): Deferred<SilentPaymentPublicScanReport> {
        if (activeJob?.isActive == true) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
        }
        val job = scope.async { scan(options) }
        activeJob = job
        job.invokeOnCompletion {
            synchronized(this) {
                if (activeJob === job) activeJob = null
            }
        }
        return job
    }

    @Synchronized
    fun cancel() {
        activeJob?.cancel()
    }

    suspend fun scan(options: SilentPaymentScanOptions): SilentPaymentPublicScanReport =
        scanMutex.withLock {
            if (!walletSession.isUnlocked.value) {
                val error = NativeSilentPaymentException(NativeErrorCode.WALLET_LOCKED)
                _state.value = SilentPaymentScanState.Failed(error.code)
                throw error
            }
            try {
                runScan(options)
            } catch (error: CancellationException) {
                _state.value = SilentPaymentScanState.Cancelled
                throw error
            } catch (error: NativeSilentPaymentException) {
                _state.value = SilentPaymentScanState.Failed(error.code)
                throw error
            } catch (_: Exception) {
                _state.value = SilentPaymentScanState.Failed(NativeErrorCode.INTERNAL)
                throw NativeSilentPaymentException(NativeErrorCode.INTERNAL)
            }
        }

    private suspend fun runScan(options: SilentPaymentScanOptions): SilentPaymentPublicScanReport {
        val networkKey = options.network.name.lowercase()
        val storedCursorEntity = repository.getSilentPaymentCursor(networkKey)
        val storedCursor = storedCursorEntity?.let(SilentPaymentPersistenceMapper::fromCursorEntity)
        val nextCursorHeight = storedCursor?.let { cursor ->
            if (cursor.lastScannedHeight == Long.MAX_VALUE) {
                throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
            }
            cursor.lastScannedHeight + 1
        }
        val startHeight = options.startHeight ?: (nextCursorHeight ?: 0L)

        if (storedCursor != null) {
            if (startHeight < storedCursor.lastScannedHeight) {
                throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
            }
            if (nextCursorHeight != null && startHeight > nextCursorHeight) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
            }
        }
        val cursorNextHeight = if (storedCursor != null) {
            nextCursorHeight ?: throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        } else {
            null
        }
        if (startHeight > options.endHeight) {
            val existing = repository.silentPaymentUtxosOnce(networkKey)
                .map(SilentPaymentPersistenceMapper::toPublic)
            val report = SilentPaymentPublicScanReport(
                utxos = existing,
                metrics = SilentPaymentPublicMetrics(0, 0, 0, 0, storedCursor?.lastScannedHeight, null),
                cursor = storedCursor,
            )
            _state.value = SilentPaymentScanState.Completed(report)
            return report
        }

        val rangeSpan = try {
            Math.subtractExact(options.endHeight, startHeight)
        } catch (_: ArithmeticException) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        if (rangeSpan >= com.conxius.wallet.bitcoin.MAX_SCAN_BLOCKS) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        val range = ScanRange(startHeight, options.endHeight)
        var priorCursor = storedCursor
        var activeBlockHash: String? = null
        var activeBlockHeight: Long? = null
        var blockFinal = true
        var scannedBlocks = 0L
        var scannedTransactions = 0L
        var skippedTransactions = 0L
        var matchCount = 0L
        var currentHeight: Long? = null
        var currentTipHeight: Long? = null
        var expectedBatchOffset = 0L
        var lastTransactionIndex = -1L
        val seenTransactionIdentities = HashSet<String>()
        val pendingEntities = ArrayList<SilentPaymentUtxoEntity>()

        _state.value = SilentPaymentScanState.Scanning(
            SilentPaymentScanProgress(
                startHeight = startHeight,
                endHeight = options.endHeight,
                currentHeight = null,
                scannedBlocks = 0,
                scannedTransactions = 0,
                skippedTransactions = 0,
                matchCount = 0,
                currentTipHeight = null,
            ),
        )

        blockSource.batches(options.network, range).collect { batch ->
            validateBatchMetadata(batch, options.network, range)
            val batchHeight = batch.blockHeight ?: batch.transactions.firstOrNull()?.blockHeight
                ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            val batchHash = batch.blockHash
                ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

            if (activeBlockHash == null || activeBlockHash != batchHash) {
                if (!blockFinal) throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                val previousHeight = activeBlockHeight
                if (previousHeight != null) {
                    val nextBlockHeight = try {
                        Math.addExact(previousHeight, 1L)
                    } catch (_: ArithmeticException) {
                        throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
                    }
                    if (batchHeight != nextBlockHeight) {
                        throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                    }
                }
                if (activeBlockHeight != null && batch.previousBlockHash != activeBlockHash) {
                    throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                }
                if (activeBlockHeight == null && batchHeight != range.startBlock) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
                }
                if (activeBlockHeight == null && storedCursor != null) {
                    when (batchHeight) {
                        storedCursor.lastScannedHeight -> {
                            if (batchHash != storedCursor.lastScannedBlockHash) {
                                throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                            }
                        }
                        cursorNextHeight -> {
                            if (batch.previousBlockHash != storedCursor.lastScannedBlockHash) {
                                throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                            }
                        }
                        else -> throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
                    }
                }
                activeBlockHash = batchHash
                activeBlockHeight = batchHeight
                expectedBatchOffset = 0L
                lastTransactionIndex = -1L
                seenTransactionIdentities.clear()
                pendingEntities.clear()
            } else if (blockFinal) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            } else if (batchHeight != activeBlockHeight) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }

            if (batch.batchTransactionOffset != expectedBatchOffset) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
            batch.transactions.forEach { transaction ->
                if (transaction.blockHeight != batchHeight) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                if (transaction.transactionIndex <= lastTransactionIndex) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                val identity = "${transaction.transactionIdLittleEndian.toHexKey()}:" +
                    "${transaction.blockHeight}:${transaction.transactionIndex}"
                if (!seenTransactionIdentities.add(identity)) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                lastTransactionIndex = transaction.transactionIndex
            }

            currentHeight = batchHeight
            currentTipHeight = batch.currentTipHeight
            val result = silentPaymentManager.scanBatch(batch)
            val entities = result.matches.map {
                SilentPaymentPersistenceMapper.toEntity(options.network, batch, it)
            }
            pendingEntities += entities
            if (batch.isFinalBatchForBlock) {
                repository.persistSilentPaymentBatch(
                    utxos = pendingEntities.toList(),
                    cursor = SilentPaymentPersistenceMapper.toCursorEntity(
                        SilentPaymentCursor(options.network, batchHeight, batchHash),
                    ),
                )
                pendingEntities.clear()
            }

            val batchTransactionCount = checkedAdd(
                result.metrics.transactionCount,
                batch.skippedTransactionCount,
            )
            scannedTransactions = checkedAdd(scannedTransactions, batchTransactionCount)
            skippedTransactions = checkedAdd(
                skippedTransactions,
                result.metrics.skippedTransactionCount + batch.skippedTransactionCount,
            )
            matchCount = checkedAdd(matchCount, result.matches.size.toLong())
            expectedBatchOffset = checkedAdd(expectedBatchOffset, batch.transactions.size.toLong())
            blockFinal = batch.isFinalBatchForBlock
            if (batch.isFinalBatchForBlock) {
                scannedBlocks = checkedAdd(scannedBlocks, 1)
                priorCursor = SilentPaymentCursor(options.network, batchHeight, batchHash)
            }
            _state.value = SilentPaymentScanState.Scanning(
                SilentPaymentScanProgress(
                    startHeight = startHeight,
                    endHeight = options.endHeight,
                    currentHeight = currentHeight,
                    scannedBlocks = scannedBlocks,
                    scannedTransactions = scannedTransactions,
                    skippedTransactions = skippedTransactions,
                    matchCount = matchCount,
                    currentTipHeight = currentTipHeight,
                ),
            )
        }

        if (!blockFinal) throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        val expectedBlockCount = checkedAdd(rangeSpan, 1L)
        if (scannedBlocks != expectedBlockCount) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
        val persisted = repository.silentPaymentUtxosOnce(networkKey)
            .map(SilentPaymentPersistenceMapper::toPublic)
        val report = SilentPaymentPublicScanReport(
            utxos = persisted,
            metrics = SilentPaymentPublicMetrics(
                scannedBlocks = scannedBlocks,
                scannedTransactions = scannedTransactions,
                skippedTransactions = skippedTransactions,
                matchCount = matchCount,
                currentHeight = currentHeight,
                currentTipHeight = currentTipHeight,
            ),
            cursor = priorCursor,
        )
        _state.value = SilentPaymentScanState.Completed(report)
        return report
    }

    private fun validateBatchMetadata(batch: SilentPaymentBatch, network: SilentPaymentNetwork, range: ScanRange) {
        if (batch.network != network || batch.range != range) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_BATCH)
        }
        if (batch.blockHeight != null && batch.blockHeight !in range.startBlock..range.endBlock) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
        if (batch.currentTipHeight != null && batch.currentTipHeight < range.endBlock) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
        }
        if (batch.blockHash != null && !batch.blockHash.matches(HEX_64)) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
        if (batch.previousBlockHash != null && !batch.previousBlockHash.matches(HEX_64)) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
        if (batch.currentTipHash != null && !batch.currentTipHash.matches(HEX_64)) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
    }

    private fun checkedAdd(left: Long, right: Long): Long =
        try {
            Math.addExact(left, right)
        } catch (_: ArithmeticException) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }

    private fun ByteArray.toHexKey(): String =
        joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }

    private companion object {
        val HEX_64 = Regex("[0-9a-f]{64}")
    }
}
