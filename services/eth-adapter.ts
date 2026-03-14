
import { Buffer } from 'buffer';
import { keccak256 } from './evm';

/**
 * ETH Adapter (Sovereign Implementation)
 *
 * Provides EIP-712 and ERC-4337 support for the Bitcoin-native Conclave.
 * This allows the same sovereign root to control EVM addresses via NTT bridges.
 *
 * Consistent with the Sovereign Architect's requirements:
 * 1. Enables Control of ETH addresses via Bitcoin-native keys.
 * 2. Implements EIP-712 hashing for typed data signing.
 */
export class EthAdapter {
    /**
     * Hashes a simple EIP-712 typed data structure.
     *
     * @param domain EIP-712 Domain object
     * @param primaryType The primary type being signed
     * @param message The message data
     * @param types The type definitions
     */
    static hashTypedData(domain: any, primaryType: string, message: any, types: any): Uint8Array {
        const domainSeparator = this.hashStruct('EIP712Domain', domain, types);
        const messageHash = this.hashStruct(primaryType, message, types);

        const pack = Buffer.concat([
            Buffer.from([0x19, 0x01]),
            Buffer.from(domainSeparator),
            Buffer.from(messageHash)
        ]);

        return keccak256(pack);
    }

    private static hashStruct(type: string, data: any, types: any): Uint8Array {
        const typeHash = this.getTypeHash(type, types);
        const encodedData = this.encodeData(type, data, types);

        return keccak256(Buffer.concat([Buffer.from(typeHash), Buffer.from(encodedData)]));
    }

    private static getTypeHash(type: string, types: any): Uint8Array {
        const members = types[type] || [];
        const encoded = `${type}(${members.map((m: any) => `${m.type} ${m.name}`).join(',')})`;
        return keccak256(new TextEncoder().encode(encoded));
    }

    private static encodeData(type: string, data: any, types: any): Uint8Array {
        const members = types[type] || [];
        const parts: Buffer[] = [];

        for (const member of members) {
            const value = data[member.name];
            if (member.type === 'string' || member.type === 'bytes') {
                parts.push(Buffer.from(keccak256(typeof value === 'string' ? new TextEncoder().encode(value) : value)));
            } else if (types[member.type]) {
                parts.push(Buffer.from(this.hashStruct(member.type, value, types)));
            } else {
                const buf = Buffer.alloc(32);
                if (typeof value === 'bigint') {
                    // Correctly handle full 256-bit integers for EVM compatibility
                    let hex = value.toString(16);
                    if (hex.length % 2 !== 0) hex = '0' + hex;
                    const valBuf = Buffer.from(hex, 'hex');
                    buf.set(valBuf, 32 - valBuf.length);
                } else if (typeof value === 'number') {
                    buf.writeUInt32BE(value, 28);
                } else if (typeof value === 'boolean') {
                    buf.writeUInt8(value ? 1 : 0, 31);
                } else if (typeof value === 'string' && value.startsWith('0x')) {
                    const clean = value.replace('0x', '');
                    const addrBuf = Buffer.from(clean, 'hex');
                    buf.set(addrBuf, 32 - addrBuf.length);
                }
                parts.push(buf);
            }
        }

        return Buffer.concat(parts);
    }

    /**
     * Constructs an ERC-4337 UserOperation for Bitcoin-native control of ETH addresses.
     *
     * @param sender The proxy/wallet address on ETH
     * @param nonce The current nonce of the sender
     * @param callData The transaction data to execute
     * @param callGasLimit Gas limit for the main execution
     * @param verificationGasLimit Gas limit for the validation phase
     * @param preVerificationGas Gas for overhead
     * @param maxFeePerGas Maximum fee per gas
     * @param maxPriorityFeePerGas Maximum priority fee per gas
     */
    static createUserOperation(
        sender: string,
        nonce: bigint,
        callData: Uint8Array,
        callGasLimit: bigint = 100000n,
        verificationGasLimit: bigint = 100000n,
        preVerificationGas: bigint = 50000n,
        maxFeePerGas: bigint = 2000000000n,
        maxPriorityFeePerGas: bigint = 1000000000n
    ): any {
        return {
            sender,
            nonce: '0x' + nonce.toString(16),
            initCode: '0x',
            callData: '0x' + Buffer.from(callData).toString('hex'),
            callGasLimit: '0x' + callGasLimit.toString(16),
            verificationGasLimit: '0x' + verificationGasLimit.toString(16),
            preVerificationGas: '0x' + preVerificationGas.toString(16),
            maxFeePerGas: '0x' + maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas.toString(16),
            paymasterAndData: '0x',
            signature: '0x' // To be filled by Conclave signature
        };
    }
}
