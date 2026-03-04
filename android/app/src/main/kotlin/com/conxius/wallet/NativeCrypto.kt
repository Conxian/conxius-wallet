package com.conxius.wallet

import org.json.JSONObject
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import java.util.Arrays

object NativeCrypto {
    private const val GCM_TAG_BITS = 128

    fun decryptVault(vaultJson: String, pin: String): ByteArray {
        val envelope = JSONObject(vaultJson)
        val v = envelope.getInt("v")
        if (v != 1) throw IllegalArgumentException("Unknown vault version")

        val saltJson = envelope.getJSONArray("salt")
        val ivJson = envelope.getJSONArray("iv")
        val dataJson = envelope.getJSONArray("data")

        val salt = ByteArray(saltJson.length()) { saltJson.getInt(it).toByte() }
        val iv = ByteArray(ivJson.length()) { ivJson.getInt(it).toByte() }
        val data = ByteArray(dataJson.length()) { dataJson.getInt(it).toByte() }

        // Derive Key: PBKDF2WithHmacSHA256, 200000 iterations
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val pinChars = pin.toCharArray()
        val spec = PBEKeySpec(pinChars, salt, 200000, 256)
        val tmp = factory.generateSecret(spec)

        // Zero-out PIN array immediately
        Arrays.fill(pinChars, '\u0000')
        spec.clearPassword()

        val encodedKey = tmp.encoded
        val secret = SecretKeySpec(encodedKey, "AES")
        Arrays.fill(encodedKey, 0.toByte())

        // Decrypt: AES/GCM/NoPadding
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(GCM_TAG_BITS, iv))

        return cipher.doFinal(data)
    }
}
