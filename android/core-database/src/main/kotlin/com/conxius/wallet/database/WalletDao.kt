package com.conxius.wallet.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface WalletDao {
    @Query("SELECT * FROM encrypted_seed WHERE id = 0")
    suspend fun getSeed(): EncryptedSeedEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSeed(seed: EncryptedSeedEntity)

    @Query("DELETE FROM encrypted_seed")
    suspend fun clearSeed()

    @Query("SELECT * FROM utxos")
    fun getAllUtxos(): Flow<List<UtxoEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUtxos(utxos: List<UtxoEntity>)

    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<TransactionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransactions(txs: List<TransactionEntity>)

    @Query("SELECT * FROM assets")
    fun getAllAssets(): Flow<List<AssetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssets(assets: List<AssetEntity>)

    @Query("SELECT * FROM silent_payment_utxos WHERE network = :network ORDER BY blockHeight ASC, transactionIndex ASC, vout ASC")
    fun getSilentPaymentUtxos(network: String): Flow<List<SilentPaymentUtxoEntity>>

    @Query("SELECT * FROM silent_payment_utxos WHERE network = :network ORDER BY blockHeight ASC, transactionIndex ASC, vout ASC")
    suspend fun getSilentPaymentUtxosOnce(network: String): List<SilentPaymentUtxoEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSilentPaymentUtxos(utxos: List<SilentPaymentUtxoEntity>)

    @Query("SELECT * FROM silent_payment_scan_cursor WHERE network = :network")
    suspend fun getSilentPaymentCursor(network: String): SilentPaymentScanCursorEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSilentPaymentCursor(cursor: SilentPaymentScanCursorEntity)

    @Query("DELETE FROM silent_payment_utxos")
    suspend fun clearSilentPaymentUtxos()

    @Query("DELETE FROM silent_payment_scan_cursor")
    suspend fun clearSilentPaymentCursors()

    /** Replacing a wallet seed must never retain the previous wallet's public scan state. */
    @Transaction
    suspend fun replaceSeed(seed: EncryptedSeedEntity) {
        insertSeed(seed)
        clearSilentPaymentUtxos()
        clearSilentPaymentCursors()
    }

    @Transaction
    suspend fun clearWalletData() {
        clearSeed()
        clearSilentPaymentUtxos()
        clearSilentPaymentCursors()
    }

    /** Match upserts and cursor advancement share one Room transaction. */
    @Transaction
    suspend fun persistSilentPaymentBatch(
        utxos: List<SilentPaymentUtxoEntity>,
        cursor: SilentPaymentScanCursorEntity?,
    ) {
        if (utxos.isNotEmpty()) upsertSilentPaymentUtxos(utxos)
        if (cursor != null) upsertSilentPaymentCursor(cursor)
    }
}
