package com.conxius.wallet.repository

import com.conxius.wallet.bitcoin.SilentPaymentBatch
import com.conxius.wallet.bitcoin.SilentPaymentCursor
import com.conxius.wallet.bitcoin.SilentPaymentMatch
import com.conxius.wallet.bitcoin.SilentPaymentMatchKind
import com.conxius.wallet.bitcoin.SilentPaymentNetwork
import com.conxius.wallet.bitcoin.SilentPaymentPublicUtxo
import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import com.conxius.wallet.bitcoin.MAX_MONEY_SAT
import com.conxius.wallet.database.SilentPaymentScanCursorEntity
import com.conxius.wallet.database.SilentPaymentUtxoEntity

object SilentPaymentPersistenceMapper {
    fun toEntity(
        network: SilentPaymentNetwork,
        batch: SilentPaymentBatch,
        match: SilentPaymentMatch,
    ): SilentPaymentUtxoEntity {
        // Native outputIndex addresses the compact Taproot-only vector; the selected output carries
        // the original transaction vout in its outpoint.
        val output = batch.transactions
            .firstOrNull {
                it.transactionIdLittleEndian.contentEquals(match.transactionIdLittleEndian)
                    && it.blockHeight == match.blockHeight
                    && it.transactionIndex == match.transactionIndex
            }
            ?.outputs
            ?.getOrNull(match.outputIndex.toInt())
            ?: invalidPublicRecord()
        if (!output.outputKey.contentEquals(match.outputKey)
            || !output.outpoint.txidLittleEndian.contentEquals(match.outpoint.txidLittleEndian)
            || output.outpoint.vout != match.outpoint.vout
            || output.valueSat != match.valueSat
            || output.isUnspent != match.isUnspent
            || match.valueSat !in 0..MAX_MONEY_SAT
            || !match.outpoint.txidLittleEndian.contentEquals(match.transactionIdLittleEndian)
            || !output.outpoint.txidLittleEndian.contentEquals(match.transactionIdLittleEndian)
        ) {
            invalidPublicRecord()
        }
        val spentnessKnown = output.spentnessKnown
        val spentState = when {
            !spentnessKnown -> "UNKNOWN"
            output.isUnspent -> "UNSPENT"
            else -> "SPENT"
        }
        val txidLittleEndianHex = output.outpoint.txidLittleEndian.toHex()
        val txid = output.outpoint.txidLittleEndian.reversedArray().toHex()
        val outpoint = "$txid:${output.outpoint.vout}"
        val (matchKind, labelIndex) = when (val kind = match.kind) {
            SilentPaymentMatchKind.Unlabeled -> "UNLABELED" to null
            is SilentPaymentMatchKind.Label -> {
                if (kind.index !in batch.labels) invalidPublicRecord()
                "LABEL" to kind.index
            }
        }
        return SilentPaymentUtxoEntity(
            network = network.name.lowercase(),
            outpoint = outpoint,
            txidLittleEndianHex = txidLittleEndianHex,
            vout = output.outpoint.vout,
            valueSat = output.valueSat,
            outputKeyHex = output.outputKey.toHex(),
            blockHeight = match.blockHeight,
            transactionIndex = match.transactionIndex,
            source = "esplora",
            spentState = spentState,
            spentnessKnown = spentnessKnown,
            matchKind = matchKind,
            labelIndex = labelIndex,
            matchedNegatedOutputKey = match.matchedNegatedOutputKey,
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun toPublic(entity: SilentPaymentUtxoEntity): SilentPaymentPublicUtxo {
        val network = runCatching {
            SilentPaymentNetwork.valueOf(entity.network.uppercase())
        }.getOrElse { invalidPublicRecord() }
        if (entity.network != network.name.lowercase()) invalidPublicRecord()
        if (entity.txidLittleEndianHex != entity.txidLittleEndianHex.lowercase()
            || entity.outputKeyHex != entity.outputKeyHex.lowercase()
        ) {
            invalidPublicRecord()
        }
        val txidLittleEndian = entity.txidLittleEndianHex.decodeHexOrNull(32)
            ?: invalidPublicRecord()
        val txid = txidLittleEndian.reversedArray().toHex()
        val outputKey = entity.outputKeyHex.decodeHexOrNull(32)
            ?: invalidPublicRecord()
        if (entity.vout !in 0..0xffff_ffffL || entity.valueSat !in 0..MAX_MONEY_SAT
            || entity.blockHeight !in 0..MAX_SAFE_JS_INTEGER
            || entity.transactionIndex !in 0..0xffff_ffffL
            || entity.updatedAt < 0
        ) {
            invalidPublicRecord()
        }
        if (entity.outpoint != "$txid:${entity.vout}") invalidPublicRecord()
        if (entity.source != "esplora") invalidPublicRecord()
        when (entity.spentState) {
            "UNKNOWN" -> if (entity.spentnessKnown) invalidPublicRecord()
            "UNSPENT", "SPENT" -> if (!entity.spentnessKnown) invalidPublicRecord()
            else -> invalidPublicRecord()
        }
        when (entity.matchKind) {
            "UNLABELED" -> if (entity.labelIndex != null) invalidPublicRecord()
            "LABEL" -> if (entity.labelIndex == null || entity.labelIndex !in 0..0xffff_ffffL) {
                invalidPublicRecord()
            }
            else -> invalidPublicRecord()
        }
        return SilentPaymentPublicUtxo(
            network = network,
            outpoint = entity.outpoint,
            txid = txid,
            vout = entity.vout,
            valueSat = entity.valueSat,
            outputKeyHex = outputKey.toHex(),
            blockHeight = entity.blockHeight,
            transactionIndex = entity.transactionIndex,
            source = entity.source,
            spentState = entity.spentState,
            spentnessKnown = entity.spentnessKnown,
            matchKind = entity.matchKind,
            labelIndex = entity.labelIndex,
            matchedNegatedOutputKey = entity.matchedNegatedOutputKey,
        )
    }

    fun toCursorEntity(cursor: SilentPaymentCursor): SilentPaymentScanCursorEntity =
        SilentPaymentScanCursorEntity(
            network = cursor.network.name.lowercase(),
            lastScannedHeight = cursor.lastScannedHeight,
            lastScannedBlockHash = cursor.lastScannedBlockHash,
            updatedAt = System.currentTimeMillis(),
        )

    fun fromCursorEntity(entity: SilentPaymentScanCursorEntity): SilentPaymentCursor =
        run {
            val network = runCatching {
                SilentPaymentNetwork.valueOf(entity.network.uppercase())
            }.getOrElse { invalidPublicRecord() }
            if (entity.network != network.name.lowercase()
                || entity.lastScannedBlockHash != entity.lastScannedBlockHash.lowercase()
                || !entity.lastScannedBlockHash.matches(HEX_64)
                || entity.lastScannedHeight !in 0..MAX_SAFE_JS_INTEGER
            ) {
                invalidPublicRecord()
            }
            SilentPaymentCursor(
                network = network,
                lastScannedHeight = entity.lastScannedHeight,
                lastScannedBlockHash = entity.lastScannedBlockHash,
            )
        }

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02x".format(it.toInt() and 0xff) }

    private fun String.decodeHexOrNull(expectedBytes: Int): ByteArray? {
        if (length != expectedBytes * 2 || any { !it.isHexDigit() }) return null
        return ByteArray(expectedBytes) { index ->
            ((this[index * 2].hexValue() shl 4) or this[index * 2 + 1].hexValue()).toByte()
        }
    }

    private fun invalidPublicRecord(): Nothing =
        throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

    private fun Char.isHexDigit(): Boolean = this in '0'..'9' || this in 'a'..'f' || this in 'A'..'F'

    private fun Char.hexValue(): Int = when (this) {
        in '0'..'9' -> code - '0'.code
        in 'a'..'f' -> code - 'a'.code + 10
        in 'A'..'F' -> code - 'A'.code + 10
        else -> error("invalid hex")
    }

    private val HEX_64 = Regex("[0-9a-f]{64}")
    private const val MAX_SAFE_JS_INTEGER = 9_007_199_254_740_991L
}
