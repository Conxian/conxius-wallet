
import { Buffer } from 'buffer';

/**
 * NTT Transceiver Module (Sovereign Implementation)
 *
 * This module handles the formatting of Native Token Transfer (NTT) messages
 * into Wormhole-compatible Verified Action Approvals (VAAs).
 *
 * Consistent with the Sovereign Architect's requirements:
 * 1. It does NOT manage keys.
 * 2. It accepts Conclave-signed payloads.
 * 3. It formats them into VAA structure for transport.
 */
export class NttTransceiver {
    /**
     * Formats a Conclave-signed NTT payload into a Wormhole VAA.
     *
     * @param payload The raw NTT message payload (serialized NativeTokenTransfer)
     * @param signature The 64/65-byte ECDSA signature from the Conclave
     * @param emitterChain The Wormhole Chain ID of the source
     * @param emitterAddress The 32-byte address of the source NTT Manager
     * @param sequence The sequence number of the message
     */
    static formatSovereignVaa(
        payload: Uint8Array,
        signature: Uint8Array,
        emitterChain: number,
        emitterAddress: Uint8Array,
        sequence: bigint
    ): Uint8Array {
        // VAA Body Construction
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 0;
        const consistencyLevel = 1;

        const body = Buffer.alloc(51 + payload.length);
        body.writeUInt32BE(timestamp, 0);
        body.writeUInt32BE(nonce, 4);
        body.writeUInt16BE(emitterChain, 8);
        body.set(emitterAddress, 10);
        body.writeBigUInt64BE(sequence, 42);
        body.writeUInt8(consistencyLevel, 50);
        body.set(payload, 51);

        // VAA Header
        const header = Buffer.alloc(6);
        header.writeUInt8(1, 0);      // VAA Version
        header.writeUInt32BE(0, 1);   // Guardian Set Index
        header.writeUInt8(1, 5);      // Number of Signatures

        // Signature Entry (1 byte index + 64 bytes rs + 1 byte v)
        const sigEntry = Buffer.alloc(66);
        sigEntry.writeUInt8(0, 0);    // Sovereign Guardian Index (0)

        // Compact signature (r, s)
        sigEntry.set(signature.slice(0, 64), 1);

        // Recovery ID (v)
        let v = signature.length > 64 ? signature[64] : 0;
        if (v < 27) v += 27; // Ensure ETH-style v if needed, though Wormhole uses 0/1 usually
        sigEntry.writeUInt8(v - 27, 65);

        return Buffer.concat([header, sigEntry, body]);
    }

    /**
     * Creates an NTT payload following the canonical Wormhole NTT specification.
     * Layout: Prefix(4), TrimmedAmount(9), SourceToken(32), Recipient(32), RecipientChain(2), AdditionalPayload(var)
     */
    static createNttPayload(
        amount: bigint,
        decimals: number,
        sourceToken: Uint8Array,
        recipient: Uint8Array,
        recipientChain: number
    ): Uint8Array {
        const prefix = Buffer.from([0x99, 0x4e, 0x54, 0x54]); // 0x99NTT

        // Trimmed Amount: 1 byte decimals + 8 bytes amount
        const trimmedAmount = Buffer.alloc(9);
        trimmedAmount.writeUInt8(decimals, 0);
        trimmedAmount.writeBigUInt64BE(amount, 1);

        const recipientChainBuf = Buffer.alloc(2);
        recipientChainBuf.writeUInt16BE(recipientChain, 0);

        // Optional Additional Payload (empty for now, length 0)
        const additionalPayload = Buffer.alloc(2, 0);

        return Buffer.concat([
            prefix,
            trimmedAmount,
            sourceToken,
            recipient,
            recipientChainBuf,
            additionalPayload
        ]);
    }
}
