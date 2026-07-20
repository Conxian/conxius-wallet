package com.conxius.wallet.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "encrypted_seed")
data class EncryptedSeedEntity(
    @PrimaryKey val id: Int = 0,
    val encryptedSeed: ByteArray,
    val iv: ByteArray
)

@Entity(tableName = "utxos")
data class UtxoEntity(
    @PrimaryKey val outpoint: String,
    val value: Long,
    val scriptType: String,
    val isSpent: Boolean = false
)

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val txid: String,
    val timestamp: Long,
    val received: Long,
    val sent: Long,
    val fee: Long?,
    val label: String? = null
)

@Entity(tableName = "assets")
data class AssetEntity(
    @PrimaryKey val id: String, // e.g. "BTC", "STX", "L-BTC"
    val name: String,
    val symbol: String,
    val balance: String, // String to handle large numbers/precision safely
    val type: String, // e.g. "L1", "L2", "Sidechain", "RGB"
    val updatedAt: Long
)

/** Public silent-payment match metadata only; no shared secret, tweak, scan key, or xpriv. */
@Entity(
    tableName = "silent_payment_utxos",
    primaryKeys = ["network", "outpoint"],
    indices = [Index(value = ["network", "blockHeight"])]
)
data class SilentPaymentUtxoEntity(
    val network: String,
    val outpoint: String,
    val txidLittleEndianHex: String,
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
    val updatedAt: Long,
)

@Entity(tableName = "silent_payment_scan_cursor")
data class SilentPaymentScanCursorEntity(
    @PrimaryKey val network: String,
    val lastScannedHeight: Long,
    val lastScannedBlockHash: String,
    val updatedAt: Long,
)
