package com.conxius.wallet.bitcoin

import java.io.ByteArrayOutputStream
import java.util.HashSet

/** Versioned, hand-rolled public batch/result codec shared with the Rust JNI crate. */
object SilentPaymentCodec {
    private val BATCH_MAGIC = byteArrayOf('S'.code.toByte(), 'P'.code.toByte(), 'B'.code.toByte(), '1'.code.toByte())
    private val RESULT_MAGIC = byteArrayOf('S'.code.toByte(), 'P'.code.toByte(), 'R'.code.toByte(), '1'.code.toByte())
    private const val VERSION = 1

    const val MAX_BATCH_BYTES = 8 * 1024 * 1024
    const val MAX_RESULT_BYTES = 16 * 1024 * 1024
    const val MAX_BATCH_TRANSACTIONS = 1_024
    const val MAX_BATCH_OUTPUTS = 65_536
    const val MAX_MATCHES = 65_536
    const val MAX_TRANSACTION_INPUTS = 4_096
    const val MAX_ELIGIBLE_INPUTS = 4_096
    const val MAX_TAPROOT_OUTPUTS = 4_096
    const val MAX_LABELS = 256

    fun encodeBatch(batch: SilentPaymentBatch): ByteArray {
        validateBatch(batch)
        val writer = Writer(128 + batch.transactions.size * 64, MAX_BATCH_BYTES)
        writer.bytes(BATCH_MAGIC)
        writer.u8(VERSION)
        writer.u8(batch.network.wireCode)
        writer.u32(batch.account)
        writer.u64(batch.range.startBlock)
        writer.u64(batch.range.endBlock)
        writer.u32(batch.transactions.size.toLong())
        writer.u32(batch.labels.size.toLong())
        batch.labels.forEach(writer::u32)

        batch.transactions.forEach { transaction ->
            writer.u64(transaction.blockHeight)
            writer.u32(transaction.transactionIndex)
            writer.u32(transaction.allInputOutpoints.size.toLong())
            writer.u32(transaction.eligibleInputs.size.toLong())
            writer.u32(transaction.outputs.size.toLong())
            transaction.allInputOutpoints.forEach { writeOutPoint(writer, it) }
            transaction.eligibleInputs.forEach { eligible ->
                val inputIndex = transaction.allInputOutpoints.indexOfFirst {
                    sameOutPoint(it, eligible.outpoint)
                }
                if (inputIndex < 0) fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
                writer.u32(inputIndex.toLong())
                when (val key = eligible.publicKey) {
                    is EligiblePublicKey.Compressed -> {
                        writer.u8(0)
                        writer.bytes(key.bytes)
                    }

                    is EligiblePublicKey.XOnly -> {
                        writer.u8(1)
                        writer.bytes(key.bytes)
                    }
                }
            }
            transaction.outputs.forEach { output ->
                writer.bytes(output.outputKey)
                writeOutPoint(writer, output.outpoint)
                writer.u64(output.valueSat)
                writer.u8(if (output.isUnspent) 1 else 0)
            }
        }
        if (writer.size > MAX_BATCH_BYTES) fail(NativeErrorCode.RESOURCE_LIMIT)
        return writer.toByteArray()
    }

    fun decodeBatch(bytes: ByteArray): SilentPaymentBatch {
        if (bytes.size > MAX_BATCH_BYTES) fail(NativeErrorCode.RESOURCE_LIMIT)
        val cursor = Cursor(bytes)
        if (!cursor.readBytes(4).contentEquals(BATCH_MAGIC)) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        if (cursor.readU8() != VERSION) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        val network = SilentPaymentNetwork.fromWireCode(cursor.readU8())
        val account = cursor.readU32()
        if (account != 0L) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        val startBlock = cursor.readU64()
        val endBlock = cursor.readU64()
        if (startBlock > endBlock) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        val transactionCount = cursor.readBoundedCount(MAX_BATCH_TRANSACTIONS)
        val labelCount = cursor.readBoundedCount(MAX_LABELS)

        val labels = ArrayList<Long>(labelCount)
        val seenLabels = HashSet<Long>(labelCount)
        repeat(labelCount) {
            val label = cursor.readU32()
            if (!seenLabels.add(label)) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            labels += label
        }

        val transactions = ArrayList<SilentPaymentTransaction>(transactionCount)
        var totalOutputs = 0
        repeat(transactionCount) {
            val blockHeight = cursor.readU64()
            if (blockHeight !in startBlock..endBlock) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            val transactionIndex = cursor.readU32()
            val inputCount = cursor.readBoundedCount(MAX_TRANSACTION_INPUTS)
            val eligibleCount = cursor.readBoundedCount(MAX_ELIGIBLE_INPUTS)
            val outputCount = cursor.readBoundedCount(MAX_TAPROOT_OUTPUTS)
            totalOutputs = totalOutputs.safeAdd(outputCount, MAX_BATCH_OUTPUTS)

            val allInputOutpoints = ArrayList<OutPoint>(inputCount)
            repeat(inputCount) { allInputOutpoints += readOutPoint(cursor) }

            val eligibleInputs = ArrayList<EligibleInput>(eligibleCount)
            val seenInputIndexes = HashSet<Int>(eligibleCount)
            repeat(eligibleCount) {
                val inputIndex = cursor.readU32AsCountOrFail()
                if (inputIndex >= inputCount || !seenInputIndexes.add(inputIndex)) {
                    fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
                }
                val publicKey = when (cursor.readU8()) {
                    0 -> {
                        val bytes = cursor.readBytes(33)
                        if (bytes[0].toInt() and 0xff !in 0x02..0x03) {
                            fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
                        }
                        EligiblePublicKey.Compressed(bytes)
                    }
                    1 -> EligiblePublicKey.XOnly(cursor.readBytes(32))
                    else -> fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
                }
                eligibleInputs += EligibleInput(allInputOutpoints[inputIndex], publicKey)
            }

            val outputs = ArrayList<TaprootOutput>(outputCount)
            repeat(outputCount) {
                outputs += TaprootOutput(
                    outputKey = cursor.readBytes(32),
                    outpoint = readOutPoint(cursor),
                    valueSat = cursor.readU64(),
                    isUnspent = cursor.readFlag(),
                )
            }
            transactions += SilentPaymentTransaction(
                blockHeight = blockHeight,
                transactionIndex = transactionIndex,
                allInputOutpoints = allInputOutpoints,
                eligibleInputs = eligibleInputs,
                outputs = outputs,
            )
        }
        if (!cursor.isAtEnd()) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        return SilentPaymentBatch(
            network = network,
            account = account,
            range = ScanRange(startBlock, endBlock),
            labels = labels,
            transactions = transactions,
        )
    }

    fun decodeResult(bytes: ByteArray): SilentPaymentScanResult {
        if (bytes.size > MAX_RESULT_BYTES) fail(NativeErrorCode.RESOURCE_LIMIT)
        val cursor = Cursor(bytes)
        if (!cursor.readBytes(4).contentEquals(RESULT_MAGIC)) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        if (cursor.readU8() != VERSION) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        val status = cursor.readU8()
        if (status != 0) {
            val code = NativeErrorCode.fromWireCode(status)
            if (!cursor.isAtEnd()) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            throw NativeSilentPaymentException(code)
        }

        val transactionCount = cursor.readU32()
        val scannedTransactionCount = cursor.readU32()
        val skippedTransactionCount = cursor.readU32()
        val matchCount = cursor.readBoundedCount(MAX_MATCHES)
        val elapsedMicros = cursor.readU64()
        val batchBytes = cursor.readU32()
        if (transactionCount > MAX_BATCH_TRANSACTIONS.toLong()
            || batchBytes > MAX_BATCH_BYTES.toLong()
        ) {
            fail(NativeErrorCode.RESOURCE_LIMIT)
        }
        val encodedMatchCount = cursor.readBoundedCount(MAX_MATCHES)
        if (encodedMatchCount != matchCount) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)

        val matches = ArrayList<SilentPaymentMatch>(encodedMatchCount)
        repeat(encodedMatchCount) {
            val blockHeight = cursor.readU64()
            val transactionIndex = cursor.readU32()
            val outputIndex = cursor.readU32()
            val outputKey = cursor.readBytes(32)
            val outpoint = readOutPoint(cursor)
            val valueSat = cursor.readU64()
            val isUnspent = cursor.readFlag()
            val k = cursor.readU32()
            val kind = when (cursor.readU8()) {
                0 -> SilentPaymentMatchKind.Unlabeled
                1 -> SilentPaymentMatchKind.Label(cursor.readU32())
                else -> fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            }
            val negated = cursor.readFlag()
            matches += SilentPaymentMatch(
                blockHeight = blockHeight,
                transactionIndex = transactionIndex,
                outputIndex = outputIndex,
                outputKey = outputKey,
                outpoint = outpoint,
                valueSat = valueSat,
                isUnspent = isUnspent,
                k = k,
                kind = kind,
                matchedNegatedOutputKey = negated,
            )
        }
        if (!cursor.isAtEnd()) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        if (matches.size.toLong() != matchCount.toLong()
            || scannedTransactionCount + skippedTransactionCount > transactionCount
        ) {
            fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        }
        return SilentPaymentScanResult(
            matches = matches,
            metrics = SilentPaymentMetrics(
                transactionCount = transactionCount,
                scannedTransactionCount = scannedTransactionCount,
                skippedTransactionCount = skippedTransactionCount,
                matchCount = matchCount.toLong(),
                elapsedMicros = elapsedMicros,
                batchBytes = batchBytes,
            ),
        )
    }

    /** Test seam for deterministic fake-native responses; the production JNI path only decodes. */
    fun encodeResult(result: SilentPaymentScanResult): ByteArray {
        if (result.matches.size > MAX_MATCHES || result.metrics.matchCount != result.matches.size.toLong()) {
            fail(NativeErrorCode.RESOURCE_LIMIT)
        }
        val writer = Writer(64 + result.matches.size * 100, MAX_RESULT_BYTES)
        writer.bytes(RESULT_MAGIC)
        writer.u8(VERSION)
        writer.u8(0)
        writer.u32(result.metrics.transactionCount)
        writer.u32(result.metrics.scannedTransactionCount)
        writer.u32(result.metrics.skippedTransactionCount)
        writer.u32(result.metrics.matchCount)
        writer.u64(result.metrics.elapsedMicros)
        writer.u32(result.metrics.batchBytes)
        writer.u32(result.matches.size.toLong())
        result.matches.forEach { match ->
            writer.u64(match.blockHeight)
            writer.u32(match.transactionIndex)
            writer.u32(match.outputIndex)
            writer.bytes(match.outputKey)
            writeOutPoint(writer, match.outpoint)
            writer.u64(match.valueSat)
            writer.u8(if (match.isUnspent) 1 else 0)
            writer.u32(match.k)
            when (val kind = match.kind) {
                SilentPaymentMatchKind.Unlabeled -> writer.u8(0)
                is SilentPaymentMatchKind.Label -> {
                    writer.u8(1)
                    writer.u32(kind.index)
                }
            }
            writer.u8(if (match.matchedNegatedOutputKey) 1 else 0)
        }
        if (writer.size > MAX_RESULT_BYTES) fail(NativeErrorCode.RESOURCE_LIMIT)
        return writer.toByteArray()
    }

    private fun validateBatch(batch: SilentPaymentBatch) {
        if (batch.account != 0L) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        if (batch.transactions.size > MAX_BATCH_TRANSACTIONS) fail(NativeErrorCode.RESOURCE_LIMIT)
        if (batch.labels.size > MAX_LABELS) fail(NativeErrorCode.RESOURCE_LIMIT)
        if (batch.labels.toSet().size != batch.labels.size) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)

        var totalOutputs = 0
        batch.transactions.forEach { transaction ->
            if (transaction.blockHeight !in batch.range.startBlock..batch.range.endBlock) {
                fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            }
            if (transaction.allInputOutpoints.size > MAX_TRANSACTION_INPUTS
                || transaction.eligibleInputs.size > MAX_ELIGIBLE_INPUTS
                || transaction.outputs.size > MAX_TAPROOT_OUTPUTS
            ) {
                fail(NativeErrorCode.RESOURCE_LIMIT)
            }
            totalOutputs = totalOutputs.safeAdd(transaction.outputs.size, MAX_BATCH_OUTPUTS)

            transaction.allInputOutpoints.indices.forEach { first ->
                if (transaction.allInputOutpoints.drop(first + 1).any {
                        sameOutPoint(transaction.allInputOutpoints[first], it)
                    }
                ) {
                    fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
            }
            val eligibleOutpoints = ArrayList<OutPoint>(transaction.eligibleInputs.size)
            transaction.eligibleInputs.forEach { eligible ->
                if (transaction.allInputOutpoints.none { sameOutPoint(it, eligible.outpoint) }
                    || eligibleOutpoints.any { sameOutPoint(it, eligible.outpoint) }
                ) {
                    fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                eligibleOutpoints += eligible.outpoint
            }
        }
    }

    private fun writeOutPoint(writer: Writer, outpoint: OutPoint) {
        writer.bytes(outpoint.txidLittleEndian)
        writer.u32(outpoint.vout)
    }

    private fun readOutPoint(cursor: Cursor): OutPoint =
        OutPoint(cursor.readBytes(32), cursor.readU32())

    private fun sameOutPoint(left: OutPoint, right: OutPoint): Boolean =
        left.vout == right.vout && left.txidLittleEndian.contentEquals(right.txidLittleEndian)

    private fun Int.safeAdd(value: Int, limit: Int): Int {
        val result = toLong() + value.toLong()
        if (result > limit) fail(NativeErrorCode.RESOURCE_LIMIT)
        return result.toInt()
    }

    private fun fail(code: NativeErrorCode): Nothing = throw SilentPaymentCodecException(code)

    class SilentPaymentCodecException(val code: NativeErrorCode) :
        IllegalArgumentException("invalid silent payment binary data: ${code.name}")

    private class Cursor(private val bytes: ByteArray) {
        private var position = 0

        fun isAtEnd(): Boolean = position == bytes.size

        fun readU8(): Int {
            requireRemaining(1)
            return bytes[position++].toInt() and 0xff
        }

        fun readU32(): Long {
            var result = 0L
            repeat(4) { shift -> result = result or (readU8().toLong() shl (shift * 8)) }
            return result
        }

        fun readU64(): Long {
            var result = 0L
            repeat(8) { shift ->
                val byte = readU8().toLong()
                if (shift == 7 && byte and 0x80L != 0L) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
                result = result or (byte shl (shift * 8))
            }
            return result
        }

        fun readBytes(length: Int): ByteArray {
            if (length < 0) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            requireRemaining(length)
            return bytes.copyOfRange(position, position + length).also { position += length }
        }

        fun readFlag(): Boolean = when (readU8()) {
            0 -> false
            1 -> true
            else -> fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        }

        fun readBoundedCount(limit: Int): Int {
            val count = readU32()
            if (count > limit.toLong()) {
                if (limit == MAX_BATCH_TRANSACTIONS || limit == MAX_BATCH_OUTPUTS || limit == MAX_MATCHES
                    || limit == MAX_TRANSACTION_INPUTS || limit == MAX_ELIGIBLE_INPUTS || limit == MAX_TAPROOT_OUTPUTS
                    || limit == MAX_LABELS
                ) fail(NativeErrorCode.RESOURCE_LIMIT)
                fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            }
            return count.toInt()
        }

        fun readU32AsCountOrFail(): Int {
            val value = readU32()
            if (value > Int.MAX_VALUE) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            return value.toInt()
        }

        private fun requireRemaining(length: Int) {
            if (length > bytes.size - position) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
        }
    }

    private class Writer(initialCapacity: Int, private val limit: Int) {
        private val output = ByteArrayOutputStream(initialCapacity.coerceIn(0, limit))
        val size: Int get() = output.size()

        fun bytes(value: ByteArray) {
            ensureCapacity(value.size)
            output.write(value, 0, value.size)
        }

        fun u8(value: Int) {
            if (value !in 0..0xff) fail(NativeErrorCode.INVALID_PUBLIC_BATCH)
            ensureCapacity(1)
            output.write(value)
        }

        fun u32(value: Long) {
            if (value !in 0..UINT32_MAX) fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
            ensureCapacity(4)
            repeat(4) { shift -> output.write((value ushr (shift * 8)).toInt() and 0xff) }
        }

        fun u64(value: Long) {
            if (value < 0) fail(NativeErrorCode.INVALID_PUBLIC_RECORD)
            ensureCapacity(8)
            repeat(8) { shift -> output.write((value ushr (shift * 8)).toInt() and 0xff) }
        }

        fun toByteArray(): ByteArray = output.toByteArray()

        private fun ensureCapacity(additionalBytes: Int) {
            if (additionalBytes < 0 || output.size().toLong() + additionalBytes.toLong() > limit) {
                fail(NativeErrorCode.RESOURCE_LIMIT)
            }
        }
    }
}
