import { UTXO } from '../types';

/**
 * Sovereign Smart Wallet Service (v1.2)
 * Policy descriptions and a bounded UTXO amount preflight only.
 * Miniscript compilation and transaction satisfaction are not implemented here.
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
 * Checks only the local amount preflight for VelocityLimit policies.
 * A true result is not signing authority or proof of transaction satisfaction.
 * Policies requiring signatures, transaction age or recovery evidence fail closed.
 */
export const checkPolicyCompliance = (utxos: UTXO[], policy: SpendingPolicy): boolean => {
    if (!policy.isActive) return true;

    if (policy.type !== 'VelocityLimit') return false;
    const limit = policy.metadata?.limitSats ?? 1000000;
    if (!Number.isSafeInteger(limit) || limit < 0) return false;
    let totalValue = 0;
    for (const utxo of utxos) {
        if (!Number.isSafeInteger(utxo.amount) || utxo.amount < 0) return false;
        totalValue += utxo.amount;
        if (!Number.isSafeInteger(totalValue) || totalValue > limit) return false;
    }
    return true;
};

/**
 * Preserves the public API but refuses funding-script generation until a reviewed
 * compiler, key binding and spend-path validation contract exist. UTF-8 policy
 * expression text is not compiled Bitcoin Script.
 */
export const generatePolicyScript = (
    _policy: SpendingPolicy,
    _internalPubKey: Uint8Array
): Buffer => {
    void _policy;
    void _internalPubKey;
    throw new Error('Unsupported policy script generation: verified Miniscript compilation is required');
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
