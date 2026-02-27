package com.conxius.wallet.database

import androidx.room.Entity
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
    val isSpent: Boolean
)

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val txid: String,
    val timestamp: Long,
    val received: Long,
    val sent: Long,
    val fee: Long?
)
