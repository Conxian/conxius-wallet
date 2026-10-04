package com.conxius.wallet.bitcoin

/**
 * BIP-350 bech32m codec, shared by the P2TR (BIP-86/BIP-350) and BIP-352 Silent Payments
 * address encodings. Single implementation so the two encodings cannot drift.
 */
object Bech32m {
    private const val BECH32M_CONST = 0x2bc830a3
    private const val CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val GEN = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

    /** Encode 5-bit data groups with a bech32m checksum. */
    fun encode(hrp: String, data: IntArray): String {
        require(hrp.isNotBlank()) { "empty human-readable part" }
        val expanded = hrpExpand(hrp)
        val combined = IntArray(expanded.size + data.size + 6)
        expanded.copyInto(combined, 0)
        data.copyInto(combined, expanded.size)
        val check = polymod(combined) xor BECH32M_CONST
        val sb = StringBuilder(hrp).append('1')
        for (d in data) sb.append(CHARSET[d])
        for (i in 0 until 6) sb.append(CHARSET[(check ushr (5 * (5 - i))) and 31])
        return sb.toString()
    }

    /** Encode an 8-bit payload (5-bit conversion applied) with a bech32m checksum. */
    fun encodeBytes(hrp: String, bytes: ByteArray): String =
        encode(hrp, convertBits(bytes, 8, 5, true))

    /** Decode a bech32m string into its HRP and 5-bit data groups (checksum validated). */
    fun decode(address: String): Decoded {
        var hasLower = false
        var hasUpper = false
        for (c in address) {
            require(c.code in 33..126) { "invalid bech32 character" }
            if (c in 'a'..'z') hasLower = true
            if (c in 'A'..'Z') hasUpper = true
        }
        require(!(hasLower && hasUpper)) { "mixed-case bech32 string" }
        val lower = address.lowercase()
        // BIP-173 recommends a 90-char cap, but BIP-352 silent payment addresses
        // (66-byte scan||spend payload) legitimately run to ~117 chars.
        require(lower.length in 8..1023) { "invalid bech32 length" }
        val pos = lower.lastIndexOf('1')
        require(pos in 1..(lower.length - 7)) { "invalid bech32 separator" }
        val hrp = lower.substring(0, pos)
        val data = IntArray(lower.length - pos - 1)
        for (i in pos + 1 until lower.length) {
            val idx = CHARSET.indexOf(lower[i])
            require(idx >= 0) { "invalid bech32 data character" }
            data[i - pos - 1] = idx
        }
        val expanded = hrpExpand(hrp)
        val combined = IntArray(expanded.size + data.size)
        expanded.copyInto(combined, 0)
        data.copyInto(combined, expanded.size)
        require(polymod(combined) == BECH32M_CONST) { "invalid bech32m checksum" }
        return Decoded(hrp, data.copyOfRange(0, data.size - 6))
    }

    /** BIP-173 convertBits: 8-bit bytes to 5-bit groups (and the reverse for decode). */
    fun convertBits(data: ByteArray, fromBits: Int, toBits: Int, pad: Boolean): IntArray =
        convertBits(IntArray(data.size) { data[it].toInt() and 0xff }, fromBits, toBits, pad)

    /** BIP-173 convertBits over integer groups, with the reference implementation's padding checks. */
    fun convertBits(data: IntArray, fromBits: Int, toBits: Int, pad: Boolean): IntArray {
        var acc = 0
        var bits = 0
        val maxv = (1 shl toBits) - 1
        val maxAcc = (1 shl (fromBits + toBits - 1)) - 1
        val ret = ArrayList<Int>(data.size * fromBits / toBits + 1)
        for (value in data) {
            require(value in 0 until (1 shl fromBits)) { "invalid convertBits input value" }
            acc = ((acc shl fromBits) or value) and maxAcc
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                ret.add((acc ushr bits) and maxv)
            }
        }
        if (pad) {
            if (bits > 0) ret.add((acc shl (toBits - bits)) and maxv)
        } else {
            require(bits < fromBits && ((acc shl (toBits - bits)) and maxv) == 0) {
                "invalid padding in convertBits"
            }
        }
        return ret.toIntArray()
    }

    data class Decoded(val hrp: String, val data: IntArray) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Decoded) return false
            return hrp == other.hrp && data.contentEquals(other.data)
        }

        override fun hashCode(): Int = 31 * hrp.hashCode() + data.contentHashCode()
    }

    private fun hrpExpand(hrp: String): IntArray {
        val out = IntArray(hrp.length * 2 + 1)
        var idx = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code ushr 5
        out[idx++] = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code and 31
        return out
    }

    private fun polymod(values: IntArray): Int {
        var chk = 1
        for (v in values) {
            val top = chk ushr 25
            chk = ((chk and 0x1ffffff) shl 5) xor v
            for (i in 0 until 5) {
                if (((top ushr i) and 1) == 1) chk = chk xor GEN[i]
            }
        }
        return chk
    }
}
