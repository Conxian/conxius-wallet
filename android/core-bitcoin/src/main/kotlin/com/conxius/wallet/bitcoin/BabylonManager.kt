package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * Babylon Bitcoin Staking Manager.
 *
 * Thin, stateless facade over [TaprootSigner] for the Bitcoin-native primitives
 * Babylon v1 requires: a BIP-86 single-key taproot staking address and BIP-340
 * Schnorr keypath signing of the staking/unbonding transaction digest. The
 * Babylon-specific transaction layout (tapscript committing the staker key,
 * finality-provider key, amount and timelock) is owned by the TS layer; native
 * only derives the address and signs the 32-byte digest.
 */
class BabylonManager {
    /** BIP-86 single-key P2TR staking address from a private scalar. */
    fun taprootAddress(privateKey: BigInteger, network: String = "mainnet"): String {
        val xOnly = TaprootSigner.xOnlyPublicKey(privateKey)
        val outputKey = TaprootSigner.taprootOutputKey(xOnly)
        return TaprootSigner.p2trAddress(outputKey, network)
    }

    /** BIP-340 Schnorr keypath signature over a 32-byte transaction digest. */
    fun signKeypath(privateKey: BigInteger, digest: ByteArray, auxRand: ByteArray = ByteArray(32)): ByteArray =
        TaprootSigner.schnorrSign(privateKey, digest, auxRand)
}
