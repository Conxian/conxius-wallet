package com.conxius.wallet.bitcoin

/**
 * BIP-352 Silent Payments address codec.
 *
 * A silent payment address is a bech32m string with HRP `sp` (mainnet) / `tsp` (testnet/signet/
 * regtest), a version byte of `0`, and a 66-byte payload of `B_scan || B_spend` (two 33-byte
 * compressed secp256k1 public keys, scan first). See BIP-352 §3.3.2.
 */
object SilentPaymentAddress {
    const val SCAN_KEY_BYTES = 33
    const val SPEND_KEY_BYTES = 33
    const val PAYLOAD_BYTES = SCAN_KEY_BYTES + SPEND_KEY_BYTES
    const val VERSION = 0

    /** Encode `B_scan || B_spend` as a silent payment address. */
    fun encode(scanPublicKey: ByteArray, spendPublicKey: ByteArray, network: String = "mainnet"): String {
        requireCompressed(scanPublicKey, "scan")
        requireCompressed(spendPublicKey, "spend")
        val payload = ByteArray(PAYLOAD_BYTES)
        scanPublicKey.copyInto(payload, 0)
        spendPublicKey.copyInto(payload, SCAN_KEY_BYTES)
        val data = Bech32m.convertBits(payload, 8, 5, true)
        val withVersion = IntArray(data.size + 1)
        withVersion[0] = VERSION
        data.copyInto(withVersion, 1)
        return Bech32m.encode(hrpFor(network), withVersion)
    }

    /** Decode a silent payment address into `(scanPublicKey, spendPublicKey)`. */
    fun decode(address: String): Decoded {
        val decoded = Bech32m.decode(address)
        val groups = decoded.data
        require(groups.isNotEmpty()) { "empty silent payment address" }
        require(groups[0] == VERSION) { "unsupported silent payment version ${groups[0]}" }
        val payloadGroups = groups.copyOfRange(1, groups.size)
        val bytes = Bech32m.convertBits(payloadGroups, 5, 8, false)
        require(bytes.size == PAYLOAD_BYTES) { "invalid silent payment payload length ${bytes.size}" }
        val scan = ByteArray(SCAN_KEY_BYTES) { bytes[it].toByte() }
        val spend = ByteArray(SPEND_KEY_BYTES) { bytes[SCAN_KEY_BYTES + it].toByte() }
        requireCompressed(scan, "scan")
        requireCompressed(spend, "spend")
        return Decoded(scan, spend)
    }

    private fun requireCompressed(key: ByteArray, name: String) {
        require(key.size == SCAN_KEY_BYTES) { "invalid $name public key length ${key.size}" }
        val prefix = key[0].toInt() and 0xff
        require(prefix == 0x02 || prefix == 0x03) { "invalid $name public key prefix" }
    }

    private fun hrpFor(network: String): String = when (network) {
        "testnet", "signet", "regtest" -> "tsp"
        else -> "sp"
    }

    data class Decoded(val scanPublicKey: ByteArray, val spendPublicKey: ByteArray) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Decoded) return false
            return scanPublicKey.contentEquals(other.scanPublicKey) && spendPublicKey.contentEquals(other.spendPublicKey)
        }

        override fun hashCode(): Int = 31 * scanPublicKey.contentHashCode() + spendPublicKey.contentHashCode()
    }
}
