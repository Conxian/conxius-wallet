package com.conxius.wallet.bitcoin

import java.math.BigInteger

/**
 * Nostr Wallet Connect (NIP-47) Manager.
 *
 * Thin, stateless facade over [NostrSigner] for the non-custodial signing and
 * verification of NIP-01 events. Owns no keys: the identity scalar is derived by
 * the caller from the wallet seed at the NIP-06 path (`m/44'/1237'/0'/0/0`).
 * The NWC relay transport (NIP-04/44 encryption + a Nostr relay) is
 * provider-gated and lives in the TS layer.
 */
class NwcManager {
    /** 32-byte x-only Nostr identity pubkey (hex) for a private scalar. */
    fun publicKeyHex(privateKey: BigInteger): String = NostrSigner.publicKeyHex(privateKey)

    /** NIP-01 event id (32 bytes) from the canonical serialized event. */
    fun eventId(serialized: String): ByteArray = NostrSigner.eventId(serialized)

    /** BIP-340 Schnorr signature over the 32-byte event id. */
    fun signEvent(privateKey: BigInteger, id: ByteArray, auxRand: ByteArray = ByteArray(32)): ByteArray =
        NostrSigner.signEventId(privateKey, id, auxRand)

    /** BIP-340 verification of an event signature. */
    fun verifyEvent(pubkeyXOnly: ByteArray, id: ByteArray, signature: ByteArray): Boolean =
        NostrSigner.verifyEventSignature(pubkeyXOnly, id, signature)
}
