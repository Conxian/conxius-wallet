package com.conxius.wallet.crypto

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.util.Log
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec

/**
 * Manages hardware-backed cryptographic keys for Conxius Wallet.
 * Prioritizes StrongBox (Android 9+) and falls back to Trusted Execution Environment (TEE).
 */
class StrongBoxManager(private val context: Context) {
    private val keyStoreAlias = "ConxiusSeedKey"
    private val dbKeyAlias = "ConxiusDbKey"
    private val provider = "AndroidKeyStore"
    private val TAG = "StrongBoxManager"

    init {
        val keyStore = KeyStore.getInstance(provider)
        keyStore.load(null)

        // Dynamic initialization based on hardware capabilities
        val supportsStrongBox = isStrongBoxSupported()
        Log.d(TAG, "Device supports StrongBox: $supportsStrongBox")

        if (!keyStore.containsAlias(keyStoreAlias)) {
            generateKey(keyStoreAlias, supportsStrongBox)
        }
        if (!keyStore.containsAlias(dbKeyAlias)) {
            generateKey(dbKeyAlias, supportsStrongBox)
        }
    }

    /**
     * Checks if the device supports StrongBox Keymaster.
     * StrongBox provides a higher level of security by using a dedicated hardware security module.
     */
    fun isStrongBoxSupported(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
        } else {
            false
        }
    }

    /**
     * Checks if the generated key is actually backed by StrongBox hardware.
     */
    fun isKeyStrongBoxBacked(alias: String): Boolean {
        return try {
            val key = getKey(alias)
            val factory = SecretKeyFactory.getInstance(key.algorithm, provider)
            val keyInfo = factory.getKeySpec(key, KeyInfo::class.java) as KeyInfo

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                keyInfo.securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Heuristic for older versions: check if it's in secure hardware and
                // we requested StrongBox during generation.
                keyInfo.isInsideSecureHardware
            } else {
                keyInfo.isInsideSecureHardware
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking KeyInfo: ${e.message}")
            false
        }
    }

    private fun generateKey(alias: String, useStrongBox: Boolean) {
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
            if (useStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                builder.setIsStrongBoxBacked(true)
            }
            keyGenerator.init(builder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key '$alias' generated. Requested StrongBox: $useStrongBox")
        } catch (e: Exception) {
            Log.w(TAG, "StrongBox generation failed for '$alias', falling back to TEE: ${e.message}")
            // Graceful fallback to TEE-backed Keystore
            val fallbackBuilder = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)

            keyGenerator.init(fallbackBuilder.build())
            keyGenerator.generateKey()
            Log.i(TAG, "Key '$alias' generated successfully in TEE-backed storage")
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
