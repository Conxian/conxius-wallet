import { describe, it, expect } from 'vitest';
import { checkNWCPermission, NWCPermission } from '../services/nostr';

describe('NIP-47: Nostr Wallet Connect', () => {
    it('should correctly check NWC permissions', () => {
        const permission: NWCPermission = {
            appPubkey: 'pub1',
            appName: 'TestApp',
            methods: ['get_balance', 'pay_invoice'],
            maxAmountSats: 100000,
            expiresAt: Date.now() + 3600000
        };

        expect(checkNWCPermission(permission, 'get_balance')).toBe(true);
        expect(checkNWCPermission(permission, 'pay_invoice', 50000)).toBe(true);
        expect(checkNWCPermission(permission, 'pay_invoice', 150000)).toBe(false);
        expect(checkNWCPermission(permission, 'make_invoice')).toBe(false);
    });
});
