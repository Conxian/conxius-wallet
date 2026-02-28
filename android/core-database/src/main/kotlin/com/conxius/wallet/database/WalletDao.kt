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
}
