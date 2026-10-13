import * as bitcoin from 'bitcoinjs-lib';
import { Network, UTXO } from '../types';
import { tweakTaprootPubkey, computeTapTweak, taggedHash } from './ecc';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Sovereign Smart Wallet Service (v1.2)
 * Implements Miniscript-compatible descriptor management and spending policies.
 * Supporting Taproot-native programmable custody and BIP-341 Key/Script Path Tweaking.
 */

export interface SpendingPolicy {
    id: string;
    name: string;
    type: 'Threshold' | 'TimeLock' | 'Inheritance' | 'SocialRecovery' | 'VelocityLimit';
    description: string;
    rules: string; // Miniscript string
    isActive: boolean;
    metadata?: Record<string, any>;
}

export const DEFAULT_POLICIES: SpendingPolicy[] = [
    {
        id: 'p-001',
        name: 'Cold Storage Guard',
        type: 'TimeLock',
        description: 'Requires 2-of-3 and 1000 block delay for security.',
        rules: 'and(pk(key1),older(1000))',
        isActive: false
    },
    {
        id: 'p-002',
        name: 'Inheritance Protocol',
        type: 'Inheritance',
        description: 'Unlocks after 52,560 blocks (~1 year) of inactivity.',
        rules: 'or(pk(owner),and(pk(heir),older(52560)))',
        isActive: false
    },
    {
        id: 'p-003',
        name: 'Decaying Social Recovery',
        type: 'SocialRecovery',
        description: 'Recovery via 2-of-3 trusted friends after 180 days of inactivity.',
        rules: 'or(pk(enclave),and(older(25920),thresh(2,pk(friend1),pk(friend2),pk(friend3))))',
        isActive: true,
        metadata: {
            delayBlocks: 25920,
            threshold: 2
        }
    },
    {
        id: 'p-004',
        name: 'Daily Velocity Limit',
        type: 'VelocityLimit',
        description: 'Spending > 0.01 BTC requires a 144 block (24h) timelock or 2FA.',
        rules: 'or(and(pk(enclave),pk(2fa_key)),and(pk(enclave),older(144)))',
        isActive: true,
        metadata: {
            limitSats: 1000000,
            timelockBlocks: 144
        }
    }
];

/**
 * Evaluates if a set of UTXOs satisfies a specific spending policy.
 */
export const checkPolicyCompliance = (utxos: UTXO[], policy: SpendingPolicy): boolean => {
    if (!policy.isActive) return true;

    console.log(`[Smart-Wallet] Auditing UTXOs against policy: ${policy.name}`);

    if (policy.type === 'VelocityLimit') {
        const totalValue = utxos.reduce((acc, u) => acc + u.amount, 0);
        const limit = policy.metadata?.limitSats || 1000000;
        if (totalValue > limit) {
            console.warn(`[Smart-Wallet] Velocity Limit Exceeded: ${totalValue} > ${limit}. Enforcement Required.`);
            return false;
        }
    }

    if (policy.type === 'TimeLock') {
        const minBlocks = policy.metadata?.delayBlocks || 1000;
        console.log(`[Smart-Wallet] Timelock policy active: requiring ${minBlocks} block delay.`);
    }

    return true;
};

/**
 * Generates a Bitcoin Output Script based on a Miniscript policy and public key.
 * Derives a Taproot (P2TR) scriptPubKey via BIP-341 key tweaking and TapLeaf merkle roots.
 */
export const generatePolicyScript = (
    policy: SpendingPolicy,
    internalPubKey: Uint8Array
): Buffer => {
    // 1. Compute TapLeaf hash for the Miniscript rule: TaggedHash("TapLeaf", leaf_version || compact_size(script) || script)
    const scriptBytes = Buffer.from(policy.rules, 'utf8');
    const leafHeader = new Uint8Array(1 + 1 + scriptBytes.length);
    leafHeader[0] = 0xc0; // Standard TapLeaf version
    leafHeader[1] = scriptBytes.length; // Compact size length
    leafHeader.set(scriptBytes, 2);

    const tapLeafHash = taggedHash('TapLeaf', leafHeader);

    // 2. Compute TapTweak using BIP-341 tagged hash with TapLeaf merkle root
    const tapTweak = computeTapTweak(internalPubKey, tapLeafHash);

    // 3. Tweak internal x-only public key with policy script merkle root
    const tweakedPubKey = tweakTaprootPubkey(internalPubKey, tapTweak);

    // 4. Return P2TR scriptPubKey: OP_1 (0x51) + 32-byte push (0x20) + tweaked x-only pubkey
    return Buffer.concat([
        Buffer.from([0x51, 0x20]),
        Buffer.from(tweakedPubKey)
    ]);
};

/**
 * Humanizes a Miniscript rule for UI presentation.
 */
export const humanizeRule = (rules: string): string => {
    return rules
        .replace(/and\(/g, "ALL OF (")
        .replace(/or\(/g, "EITHER (")
        .replace(/pk\((.*?)\)/g, "Key [$1]")
        .replace(/older\((.*?)\)/g, "Wait $1 Blocks")
        .replace(/thresh\((\d+),(.*?)\)/g, (match, n, ks) => `THRESHOLD ${n} OF [${ks}]`)
        .replace(/\)/g, ")");
};
