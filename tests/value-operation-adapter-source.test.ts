import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ADAPTER_FILES = [
    'services/ark.ts',
    'services/rgb.ts',
    'services/statechain.ts',
    'services/maven.ts',
    'services/taproot-assets.ts',
    'services/monetization.ts',
    'services/wormhole-signer.ts',
    'services/ntt.ts',
    'services/lightning.ts',
    'services/lightning-backend.ts',
    'services/swap.ts',
] as const;
const BANNED = [
    'forfeit_tx_',
    'redemption_tx_',
    'pending_on_chain_txid',
    'sim_txid_',
    'txid_withdrawal_',
    'maven_sim_txid_',
    'taproot_txid_',
    'requestEnclaveSignature',
    'notificationService',
    'SecureEnclavePlugin',
    'localStorage',
    'mock_preimage_for_unsupported_platform',
    'lnurl_pay_sim_txid_',
    'boltz_tx_',
    'gas_swap_tx_',
] as const;

describe('production adapter source contamination', () => {
    it.each(ADAPTER_FILES)('%s contains no legacy synthetic success or legacy signer path', (file) => {
        const source = readFileSync(file, 'utf8');
        for (const literal of BANNED) expect(source).not.toContain(literal);
        if (!file.endsWith('swap.ts') && !file.endsWith('lightning.ts')) expect(source).not.toContain('Date.now()');
        expect(source).not.toMatch(/consignment:\$\{Date\.now\(\)\}/);
        expect(source).not.toMatch(/contractId[\s\S]{0,200}Date\.now\(\)/);
        expect(source).not.toMatch(/return\s+srcTxids\s*\[/);
        expect(source).not.toMatch(/return\s+['"`](?:boltz|gas_swap|lnurl_pay|mock_preimage)/);
        expect(source).not.toMatch(/initiateTransfer\s*\(/);
        expect(source).not.toMatch(/BreezManager\.payInvoice\s*\(/);
        expect(source).not.toMatch(/payLnInvoice\s*\(/);
        expect(source).not.toMatch(/state\s*=\s*['"]SETTLED['"]/);
        expect(source).not.toMatch(/notify(?:Transaction)?\s*\(/);
        expect(source).not.toMatch(/setTimeout\s*\([^)]*(?:swap|payment|settle)/is);
    });
});
