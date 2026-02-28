package com.conxius.wallet.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        EncryptedSeedEntity::class,
        UtxoEntity::class,
        TransactionEntity::class,
        AssetEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun walletDao(): WalletDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "conxius_wallet_db"
                )
                .fallbackToDestructiveMigration() // For development; use real migrations for production
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
