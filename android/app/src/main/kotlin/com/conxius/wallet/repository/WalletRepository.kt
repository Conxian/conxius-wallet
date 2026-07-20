package com.conxius.wallet.repository

import com.conxius.wallet.database.AssetEntity
import com.conxius.wallet.database.SilentPaymentScanCursorEntity
import com.conxius.wallet.database.SilentPaymentUtxoEntity
import com.conxius.wallet.database.TransactionEntity
import com.conxius.wallet.database.UtxoEntity
import com.conxius.wallet.database.WalletDao
import com.conxius.wallet.session.WalletSession
import kotlinx.coroutines.flow.Flow

class WalletRepository(
    private val walletDao: WalletDao,
    private val walletSession: WalletSession,
) {
    val allAssets: Flow<List<AssetEntity>> = walletDao.getAllAssets()
    val allTransactions: Flow<List<TransactionEntity>> = walletDao.getAllTransactions()
    val allUtxos: Flow<List<UtxoEntity>> = walletDao.getAllUtxos()

    suspend fun getEncryptedSeed() = walletDao.getSeed()

    suspend fun saveSeed(encryptedSeed: ByteArray, iv: ByteArray) {
        walletSession.invalidateForWalletMutation()
        val entity = com.conxius.wallet.database.EncryptedSeedEntity(0, encryptedSeed, iv)
        walletDao.replaceSeed(entity)
    }

    suspend fun clearWallet() {
        walletSession.invalidateForWalletMutation()
        walletDao.clearWalletData()
        // Add more clearing logic as needed
    }

    suspend fun updateAssets(assets: List<AssetEntity>) {
        walletDao.insertAssets(assets)
    }

    fun silentPaymentUtxos(network: String): Flow<List<SilentPaymentUtxoEntity>> =
        walletDao.getSilentPaymentUtxos(network)

    suspend fun silentPaymentUtxosOnce(network: String): List<SilentPaymentUtxoEntity> =
        walletDao.getSilentPaymentUtxosOnce(network)

    suspend fun getSilentPaymentCursor(network: String): SilentPaymentScanCursorEntity? =
        walletDao.getSilentPaymentCursor(network)

    suspend fun persistSilentPaymentBatch(
        expectedGeneration: Long,
        utxos: List<SilentPaymentUtxoEntity>,
        cursor: SilentPaymentScanCursorEntity?,
    ): Boolean = walletSession.withActiveGeneration(expectedGeneration) {
        walletDao.persistSilentPaymentBatch(utxos, cursor)
    }?.let { true } ?: false
}
