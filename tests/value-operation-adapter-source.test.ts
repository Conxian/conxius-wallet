import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ADAPTER_FILES = [
    'services/ark.ts',
    'services/rgb.ts',
    'services/statechain.ts',
    'services/maven.ts',
    'services/taproot-assets.ts',
    'services/monetization.ts',
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
] as const;

describe('production adapter source contamination', () => {
    it.each(ADAPTER_FILES)('%s contains no legacy synthetic success or legacy signer path', (file) => {
        const source = readFileSync(file, 'utf8');
        for (const literal of BANNED) expect(source).not.toContain(literal);
        expect(source).not.toContain('Date.now()');
        expect(source).not.toMatch(/consignment:\$\{Date\.now\(\)\}/);
        expect(source).not.toMatch(/contractId[\s\S]{0,200}Date\.now\(\)/);
    });
});
