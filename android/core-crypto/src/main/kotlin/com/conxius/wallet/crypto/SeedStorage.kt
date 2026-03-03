package com.conxius.wallet.crypto

data class EncryptedData(val ciphertext: ByteArray, val iv: ByteArray)

interface SeedStorage {
    fun storeSeed(seed: ByteArray)
    fun getSeed(): ByteArray?
    fun hasSeed(): Boolean
    fun clearSeed()
}

class StrongBoxSeedStorage(private val manager: StrongBoxManager) : SeedStorage {
    private var cachedEncryptedSeed: EncryptedData? = null

    override fun storeSeed(seed: ByteArray) {
        val (ciphertext, iv) = manager.encrypt(seed)
        cachedEncryptedSeed = EncryptedData(ciphertext, iv)
    }

    override fun getSeed(): ByteArray? {
        return cachedEncryptedSeed?.let {
            manager.decrypt(it.ciphertext, it.iv)
        }
    }

    override fun hasSeed(): Boolean = cachedEncryptedSeed != null

    override fun clearSeed() {
        cachedEncryptedSeed = null
    }
}
