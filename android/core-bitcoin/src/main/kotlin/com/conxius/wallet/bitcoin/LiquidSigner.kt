package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * Liquid Network (Elements) native signing primitives.
 *
 * Elements reuses Bitcoin's secp256k1 sighash ECDSA, so transaction signing is
 * delegated to [Secp256k1Signer.signHash] (DER + sighash byte). Address derivation
 * is a standard BIP-173 P2WPKH bech32 with the Liquid human-readable part
 * (`ex` mainnet / `tex` testnet / `ert` regtest).
 *
 * Confidential addresses and output blinding remain in the TS layer
 * (`liquidjs-lib`), which owns Elements serialization; native only signs digests.
 *
 * Conformance vectors (see LiquidSignerTest) were generated against liquidjs-lib.
 */
object LiquidSigner {
    private const val BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val BECH32_GEN = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

    private fun hrpFor(network: String): String = when (network) {
        "testnet" -> "tex"
        "regtest" -> "ert"
        else -> "ex"
    }

    /** Signs a 32-byte Elements sighash, returning `DER(r, s) || 0x01`. */
    fun signDigest(privateKey: BigInteger, sighash: ByteArray): ByteArray =
        Secp256k1Signer.signHash(privateKey, sighash, Secp256k1Signer.SIGHASH_ALL)

    /** Derives the unconfidential Liquid P2WPKH (bech32) address. */
    fun addressFromPrivateKey(privateKey: BigInteger, network: String = "mainnet"): String {
        val compressed = Secp256k1Signer.publicKey(privateKey)
        val program = StacksSigner.hash160(compressed)
        return segwitAddress(hrpFor(network), 0, program)
    }

    // ── BIP-173 bech32 (segwit) ────────────────────────────────────────────────

    private fun segwitAddress(hrp: String, version: Int, program: ByteArray): String {
        val data = convertBits(program, 8, 5, true)
        val withVersion = IntArray(data.size + 1)
        withVersion[0] = version
        data.copyInto(withVersion, 1)
        return bech32Encode(hrp, withVersion)
    }

    private fun bech32Encode(hrp: String, data: IntArray): String {
        val hrpExpanded = hrpExpand(hrp)
        val combined = IntArray(hrpExpanded.size + data.size + 6)
        hrpExpanded.copyInto(combined, 0)
        data.copyInto(combined, hrpExpanded.size)
        val check = polymod(combined) xor 1

        val sb = StringBuilder(hrp).append('1')
        for (d in data) sb.append(BECH32_CHARSET[d])
        for (i in 0 until 6) sb.append(BECH32_CHARSET[(check ushr (5 * (5 - i))) and 31])
        return sb.toString()
    }

    private fun hrpExpand(hrp: String): IntArray {
        val out = IntArray(hrp.length * 2 + 1)
        var idx = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code ushr 5
        out[idx++] = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code and 31
        return out
    }

    private fun convertBits(data: ByteArray, fromBits: Int, toBits: Int, pad: Boolean): IntArray {
        var acc = 0
        var bits = 0
        val maxv = (1 shl toBits) - 1
        val ret = mutableListOf<Int>()
        for (value in data) {
            acc = (acc shl fromBits) or (value.toInt() and 0xff)
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                ret.add((acc ushr bits) and maxv)
            }
        }
        if (pad && bits > 0) {
            ret.add((acc shl (toBits - bits)) and maxv)
        }
        return ret.toIntArray()
    }

    private fun polymod(values: IntArray): Int {
        var chk = 1
        for (v in values) {
            val top = chk ushr 25
            chk = ((chk and 0x1ffffff) shl 5) xor v
            for (i in 0 until 5) {
                if (((top ushr i) and 1) == 1) chk = chk xor BECH32_GEN[i]
            }
        }
        return chk
    }
}
