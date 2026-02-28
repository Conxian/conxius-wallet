package com.conxius.wallet.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class StrongBoxManager {
    private val keyStoreAlias = "ConxiusSeedKey"
    private val provider = "AndroidKeyStore"
    private val TAG = "StrongBoxManager"

    init {
        val keyStore = KeyStore.getInstance(provider)
        keyStore.load(null)
        if (!keyStore.containsAlias(keyStoreAlias)) {
            generateKey()
        }
    }

    private fun generateKey() {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            provider
        )

        val builder = KeyGenParameterSpec.Builder(
            keyStoreAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)

        try {
            // Attempt StrongBox for Pixel/high-end devices
            builder.setIsStrongBoxBacked(true)
            keyGenerator.init(builder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key generated successfully in StrongBox")
        } catch (e: Exception) {
            Log.w(TAG, "StrongBox not available, falling back to TEE: ${e.message}")
            val fallbackBuilder = KeyGenParameterSpec.Builder(
                keyStoreAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
            keyGenerator.init(fallbackBuilder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key generated successfully in TEE")
        }
    }

    private fun getKey(): SecretKey {
        val keyStore = KeyStore.getInstance(provider)
        keyStore.load(null)
        return keyStore.getKey(keyStoreAlias, null) as SecretKey
    }

    fun encrypt(data: ByteArray): Pair<ByteArray, ByteArray> {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getKey())
            val encryptedData = cipher.doFinal(data)
            Pair(encryptedData, cipher.iv)
        } catch (e: Exception) {
            Log.e(TAG, "Encryption failed: ${e.message}")
            throw e
        }
    }

    fun decrypt(encryptedData: ByteArray, iv: ByteArray): ByteArray {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, getKey(), spec)
            cipher.doFinal(encryptedData)
        } catch (e: Exception) {
            Log.e(TAG, "Decryption failed: ${e.message}")
            throw e
        }
    }
}
