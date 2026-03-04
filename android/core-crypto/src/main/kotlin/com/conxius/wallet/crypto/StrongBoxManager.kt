package com.conxius.wallet.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.security.KeyStore
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.security.SecureRandom
import android.content.Context
import java.io.File

class StrongBoxManager(private val context: Context) {
    private val keyStoreAlias = "ConxiusSeedKey"
    private val dbKeyAlias = "ConxiusDbKey"
    private val provider = "AndroidKeyStore"
    private val TAG = "StrongBoxManager"

    init {
        val keyStore = KeyStore.getInstance(provider)
        keyStore.load(null)
        if (!keyStore.containsAlias(keyStoreAlias)) {
            generateKey(keyStoreAlias, true)
        }
        if (!keyStore.containsAlias(dbKeyAlias)) {
            generateKey(dbKeyAlias, false)
        }
    }

    private fun generateKey(alias: String, requireStrongBox: Boolean) {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            provider
        )

        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)

        try {
            if (requireStrongBox) {
                builder.setIsStrongBoxBacked(true)
            }
            keyGenerator.init(builder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key '$alias' generated successfully (StrongBox: $requireStrongBox)")
        } catch (e: Exception) {
            Log.w(TAG, "StrongBox not available for '$alias', falling back to TEE: ${e.message}")
            val fallbackBuilder = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
            keyGenerator.init(fallbackBuilder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key '$alias' generated successfully in TEE")
        }
    }

    private fun getKey(alias: String): SecretKey {
        val keyStore = KeyStore.getInstance(provider)
        keyStore.load(null)
        return keyStore.getKey(alias, null) as SecretKey
    }

    fun encrypt(data: ByteArray, alias: String = keyStoreAlias): Pair<ByteArray, ByteArray> {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getKey(alias))
            val encryptedData = cipher.doFinal(data)
            Pair(encryptedData, cipher.iv)
        } catch (e: Exception) {
            Log.e(TAG, "Encryption failed: ${e.message}")
            throw e
        } finally {
            Arrays.fill(data, 0.toByte())
        }
    }

    fun decrypt(encryptedData: ByteArray, iv: ByteArray, alias: String = keyStoreAlias): ByteArray {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, getKey(alias), spec)
            cipher.doFinal(encryptedData)
        } catch (e: Exception) {
            Log.e(TAG, "Decryption failed: ${e.message}")
            throw e
        }
    }

    fun getDatabasePassphrase(): ByteArray {
        val passphraseFile = File(context.filesDir, "db_passphrase.bin")
        val ivFile = File(context.filesDir, "db_passphrase_iv.bin")

        if (passphraseFile.exists() && ivFile.exists()) {
            val encryptedPassphrase = passphraseFile.readBytes()
            val iv = ivFile.readBytes()
            return decrypt(encryptedPassphrase, iv, dbKeyAlias)
        } else {
            val newPassphrase = ByteArray(32)
            SecureRandom().nextBytes(newPassphrase)
            val clonedPassphrase = newPassphrase.clone()
            val (encrypted, iv) = encrypt(clonedPassphrase, dbKeyAlias)
            passphraseFile.writeBytes(encrypted)
            ivFile.writeBytes(iv)
            return newPassphrase
        }
    }
}
