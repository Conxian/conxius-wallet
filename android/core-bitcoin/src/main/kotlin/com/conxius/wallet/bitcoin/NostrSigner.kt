package com.conxius.wallet.bitcoin

import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.util.encoders.Hex
import java.math.BigInteger

/**
 * Nostr (NIP-01 / NIP-06) event signing primitives.
 *
 * NIP-01 defines the canonical event envelope: the id is `sha256` of the
 * serialized event (`[0, pubkey, created_at, kind, tags, content]`), and the
 * signature is a BIP-340 Schnorr signature over that 32-byte id. NIP-06 derives
 * the identity key at `m/44'/1237'/0'/0/0`. Signing reuses [TaprootSigner];
 * this object is stateless and secret-safe (scalars are passed in, never logged).
 */
object NostrSigner {
    /** 32-byte x-only Nostr identity pubkey (hex) for a private scalar. */
    fun publicKeyHex(privateKey: BigInteger): String =
        Hex.toHexString(TaprootSigner.xOnlyPublicKey(privateKey))

    /** NIP-01 event id: sha256 of the canonical serialized event. */
    fun eventId(serialized: String): ByteArray {
        val bytes = serialized.toByteArray(Charsets.UTF_8)
        val digest = SHA256Digest()
        digest.update(bytes, 0, bytes.size)
        val out = ByteArray(digest.digestSize)
        digest.doFinal(out, 0)
        return out
    }

    /** BIP-340 Schnorr signature (64 bytes) over a 32-byte event id. */
    fun signEventId(privateKey: BigInteger, id: ByteArray, auxRand: ByteArray = ByteArray(32)): ByteArray =
        TaprootSigner.schnorrSign(privateKey, id, auxRand)

    /** BIP-340 verification of a Nostr event signature. */
    fun verifyEventSignature(pubkeyXOnly: ByteArray, id: ByteArray, signature: ByteArray): Boolean =
        TaprootSigner.schnorrVerify(pubkeyXOnly, id, signature)
}
