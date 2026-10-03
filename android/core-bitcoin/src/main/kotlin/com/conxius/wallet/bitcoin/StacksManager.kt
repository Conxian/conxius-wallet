package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * StacksManager: Native bridge for Stacks L2 and the sBTC bridge.
 *
 * A thin, stateless facade over [StacksSigner]. The private scalar is supplied by
 * the caller (derived from the wallet seed via [Secp256k1Signer] at the signing
 * boundary); this class never touches storage and never logs secrets.
 */
class StacksManager {
    /** SHA512/256 — the Stacks transaction / structured-data digest (SIP-018). */
    fun sha512256(data: ByteArray): ByteArray = StacksSigner.sha512256(data)

    /** c32check-encoded Stacks address (SIP-005) from a private scalar. */
    fun addressFromPrivateKey(privateKey: BigInteger, testnet: Boolean = false): String =
        StacksSigner.addressFromPrivateKey(privateKey, testnet)

    /** Signs a 32-byte digest and returns a 65-byte `r || s || recoveryId`. */
    fun signDigest(privateKey: BigInteger, digest: ByteArray): ByteArray =
        StacksSigner.signDigest(privateKey, digest)
}
