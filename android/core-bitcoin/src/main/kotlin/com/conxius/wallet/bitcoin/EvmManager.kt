package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * EvmManager: Native bridge for EVM-compatible Bitcoin L2s (BOB, Rootstock, B2,
 * Botanix, Mezo) and the broader EVM family (Ethereum, Base, Arbitrum, Optimism,
 * Polygon).
 *
 * A thin, stateless facade over [EvmSigner]. The private scalar is supplied by the
 * caller (derived from the wallet seed via [Secp256k1Signer] at the signing
 * boundary); this class never touches storage and never logs secrets.
 */
class EvmManager {
    /** EIP-55 checksummed EVM address for a private scalar. */
    fun addressFromPrivateKey(privateKey: BigInteger): String =
        EvmSigner.addressFromPrivateKey(privateKey)

    /** Signs an EIP-155 legacy transaction and returns the raw (RLP) bytes. */
    fun signLegacyTransaction(
        privateKey: BigInteger,
        chainId: Long,
        nonce: Long,
        gasPrice: BigInteger,
        gasLimit: Long,
        to: ByteArray,
        value: BigInteger,
        data: ByteArray,
    ): ByteArray = EvmSigner.signLegacyTransaction(
        privateKey, chainId, nonce, gasPrice, gasLimit, to, value, data,
    )

    /** Signs an EIP-1559 dynamic-fee transaction and returns the raw (RLP) bytes. */
    fun signEip1559Transaction(
        privateKey: BigInteger,
        chainId: Long,
        nonce: Long,
        maxPriorityFeePerGas: BigInteger,
        maxFeePerGas: BigInteger,
        gasLimit: Long,
        to: ByteArray,
        value: BigInteger,
        data: ByteArray,
        accessList: List<EvmSigner.AccessListItem> = emptyList(),
    ): ByteArray = EvmSigner.signEip1559Transaction(
        privateKey, chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList,
    )

    /** Signs a 32-byte digest (e.g. EIP-712 typed data) and returns `r || s || v`. */
    fun signDigest(privateKey: BigInteger, digest: ByteArray): ByteArray =
        EvmSigner.signDigest(privateKey, digest)
}
