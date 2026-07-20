package com.conxius.wallet.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.sqlcipher.database.SupportFactory

@Database(
    entities = [
        EncryptedSeedEntity::class,
        UtxoEntity::class,
        TransactionEntity::class,
        AssetEntity::class,
        SilentPaymentUtxoEntity::class,
        SilentPaymentScanCursorEntity::class,
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun walletDao(): WalletDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context, passphrase: ByteArray): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val factory = SupportFactory(passphrase)
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "conxius_wallet_db"
                )
                .openHelperFactory(factory)
                .addMigrations(MIGRATION_2_3)
                .build()
                INSTANCE = instance
                instance
            }
        }

        /** Non-destructive schema extension; existing wallet/asset/transaction rows are retained. */
        val MIGRATION_2_3 = object : androidx.room.migration.Migration(2, 3) {
            override fun migrate(database: androidx.sqlite.db.SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS silent_payment_utxos (
                        network TEXT NOT NULL,
                        outpoint TEXT NOT NULL,
                        txidLittleEndianHex TEXT NOT NULL,
                        vout INTEGER NOT NULL,
                        valueSat INTEGER NOT NULL,
                        outputKeyHex TEXT NOT NULL,
                        blockHeight INTEGER NOT NULL,
                        transactionIndex INTEGER NOT NULL,
                        source TEXT NOT NULL,
                        spentState TEXT NOT NULL,
                        spentnessKnown INTEGER NOT NULL,
                        matchKind TEXT NOT NULL,
                        labelIndex INTEGER,
                        matchedNegatedOutputKey INTEGER NOT NULL,
                        updatedAt INTEGER NOT NULL,
                        PRIMARY KEY(network, outpoint)
                    )
                    """.trimIndent(),
                )
                database.execSQL(
                    "CREATE INDEX IF NOT EXISTS index_silent_payment_utxos_network_blockHeight " +
                        "ON silent_payment_utxos(network, blockHeight)",
                )
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS silent_payment_scan_cursor (
                        network TEXT NOT NULL PRIMARY KEY,
                        lastScannedHeight INTEGER NOT NULL,
                        lastScannedBlockHash TEXT NOT NULL,
                        updatedAt INTEGER NOT NULL
                    )
                    """.trimIndent(),
                )
            }
        }
    }
}
