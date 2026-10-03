package com.conxius.wallet.bitcoin

/**
 * MuSig2 Manager (BIP-327).
 *
 * Thin, stateless facade over [Musig2Signer] for n-of-n BIP-340 multi-signatures.
 * Owns none of the session state: the TS layer coordinates participants, nonces
 * and partial signatures; native only performs the pure BIP-327 crypto. Partial
 * signing consumes the signer's 32-byte secret scalar and wipes nothing itself —
 * callers obtain scalars via [WalletSeedProvider.withSeed] as elsewhere.
 */
class Musig2Manager {
    /** KeyAgg + GetXonlyPubkey: 32-byte x-only aggregate public key. */
    fun aggregatePubkeys(pubkeys: List<ByteArray>): ByteArray = Musig2Signer.keyAggregate(pubkeys)

    /** KeySort: canonical lexicographic ordering of the compressed keys. */
    fun sortPubkeys(pubkeys: List<ByteArray>): List<ByteArray> = Musig2Signer.keySort(pubkeys)

    /** NonceGen: (secnonce, pubnonce) from high-entropy [random] (32 bytes). */
    fun generateNonce(
        sk: ByteArray?,
        pk: ByteArray,
        aggpk: ByteArray?,
        m: ByteArray?,
        extraIn: ByteArray?,
        random: ByteArray,
    ): Pair<ByteArray, ByteArray> = Musig2Signer.nonceGen(sk, pk, aggpk, m, extraIn, random)

    /** NonceAgg: 66-byte aggregate nonce. */
    fun aggregateNonces(pubnonces: List<ByteArray>): ByteArray = Musig2Signer.nonceAggregate(pubnonces)

    /** Sign: 32-byte partial signature for one signer. */
    fun signPartial(
        secnonce: ByteArray,
        sk: ByteArray,
        aggnonce: ByteArray,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
    ): ByteArray = Musig2Signer.signPartial(secnonce, sk, aggnonce, pubkeys, tweaks, isXonly, m)

    /** PartialSigVerify: true iff the signer's partial signature is valid. */
    fun verifyPartial(
        psig: ByteArray,
        pubnonce: ByteArray,
        pubnonces: List<ByteArray>,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
        signerIndex: Int,
    ): Boolean = Musig2Signer.partialSigVerify(psig, pubnonce, pubnonces, pubkeys, tweaks, isXonly, m, signerIndex)

    /** PartialSigAgg: 64-byte BIP-340 signature from the partial signatures. */
    fun aggregateSignatures(
        psigs: List<ByteArray>,
        aggnonce: ByteArray,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
    ): ByteArray = Musig2Signer.partialSigAggregate(psigs, aggnonce, pubkeys, tweaks, isXonly, m)
}
