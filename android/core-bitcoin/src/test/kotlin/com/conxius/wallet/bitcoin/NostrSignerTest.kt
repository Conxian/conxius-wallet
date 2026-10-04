package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * NIP-01 event-id + BIP-340 Schnorr sign/verify for the Nostr (NWC/NIP-47) path.
 *
 * The event-id vector is the canonical NIP-01 serialization
 * `[0, pubkey, created_at, kind, tags, content]` (same shape produced by
 * `JSON.stringify` on the TS side); its sha256 is asserted literally. BIP-340
 * verification is asserted against the official BIP-340 vector 0.
 */
class NostrSignerTest {
    @Test
    fun nip01EventIdMatchesCanonicalSerialization() {
        val serialized =
            "[0,\"3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d\",1651794653,1,[],\"hello nostr\"]"
        val id = NostrSigner.eventId(serialized)
        assertEquals(
            "5df69964c0c2879a9a326a3bda3803e0d649f860a43381e9ea2914502595bc55",
            Hex.toHexString(id),
        )
    }

    @Test
    fun bip340VerifyVector0() {
        val pubkey = Hex.decode("F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9")
        val message = ByteArray(32)
        val signature = Hex.decode(
            "E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA8215" +
                "25F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0",
        )
        assertTrue(TaprootSigner.schnorrVerify(pubkey, message, signature))
    }

    @Test
    fun bip340VerifyRejectsTamperedMessage() {
        val pubkey = Hex.decode("F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9")
        val message = ByteArray(32)
        val signature = Hex.decode(
            "E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA8215" +
                "25F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0",
        )
        val tampered = message.copyOf()
        tampered[0] = 1
        assertFalse(TaprootSigner.schnorrVerify(pubkey, tampered, signature))
    }

    @Test
    fun signAndVerifyRoundTrip() {
        val privateKey = BigInteger("112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00", 16)
        val id = NostrSigner.eventId("[0,\"pubkey\",0,1,[],\"round trip\"]")
        val signature = NostrSigner.signEventId(privateKey, id)
        val pubkey = TaprootSigner.xOnlyPublicKey(privateKey)
        assertTrue(NostrSigner.verifyEventSignature(pubkey, id, signature))
    }

    @Test
    fun verifyRejectsWrongKey() {
        val privateKey = BigInteger("112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00", 16)
        val id = NostrSigner.eventId("[0,\"pubkey\",0,1,[],\"wrong key\"]")
        val signature = NostrSigner.signEventId(privateKey, id)
        val otherKey = TaprootSigner.xOnlyPublicKey(privateKey.add(BigInteger.ONE))
        assertFalse(NostrSigner.verifyEventSignature(otherKey, id, signature))
    }
}
