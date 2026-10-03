package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * LiquidManager: Native bridge for the Liquid Network sidechain.
 *
 * A thin, stateless facade over [LiquidSigner]. The private scalar is supplied by
 * the caller (derived from the wallet seed via [Secp256k1Signer] at the signing
 * boundary); this class never touches storage and never logs secrets.
 *
 * Confidential addresses and output blinding are owned by the TS layer
 * (`liquidjs-lib`), which handles Elements serialization; native only derives the
 * unconfidential P2WPKH address and signs sighash digests.
 */
class LiquidManager {
    /** Unconfidential Liquid P2WPKH (bech32) address from a private scalar. */
    fun addressFromPrivateKey(privateKey: BigInteger, network: String = "mainnet"): String =
        LiquidSigner.addressFromPrivateKey(privateKey, network)

    /** Signs a 32-byte Elements sighash, returning `DER(r, s) || 0x01`. */
    fun signDigest(privateKey: BigInteger, sighash: ByteArray): ByteArray =
        LiquidSigner.signDigest(privateKey, sighash)
}
