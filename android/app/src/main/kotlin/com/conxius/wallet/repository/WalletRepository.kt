package com.conxius.wallet.repository

import com.conxius.wallet.database.AssetEntity
import com.conxius.wallet.database.TransactionEntity
import com.conxius.wallet.database.UtxoEntity
import com.conxius.wallet.database.WalletDao
import kotlinx.coroutines.flow.Flow

class WalletRepository(private val walletDao: WalletDao) {
    val allAssets: Flow<List<AssetEntity>> = walletDao.getAllAssets()
    val allTransactions: Flow<List<TransactionEntity>> = walletDao.getAllTransactions()
    val allUtxos: Flow<List<UtxoEntity>> = walletDao.getAllUtxos()

    suspend fun getEncryptedSeed() = walletDao.getSeed()

    suspend fun saveSeed(encryptedSeed: ByteArray, iv: ByteArray) {
        val entity = com.conxius.wallet.database.EncryptedSeedEntity(0, encryptedSeed, iv)
        walletDao.insertSeed(entity)
    }

    suspend fun clearWallet() {
        walletDao.clearSeed()
        // Add more clearing logic as needed
    }

    suspend fun updateAssets(assets: List<AssetEntity>) {
        walletDao.insertAssets(assets)
    }
}
