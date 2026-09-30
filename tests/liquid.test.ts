import { describe, it, expect } from 'vitest';
import * as liquidService from '../services/liquid';
import { UTXO } from '../types';

describe('Liquid Confidentiality & Protocol Service Suite', () => {
  const dummyPubkey = Buffer.from('02c0fe9234b694c9298e3b5266e7ea818961726a2f7c00e620573024806a0901e1', 'hex');
  const dummyBlindingPubkey = Buffer.from('02a1633cafcc01ebf3d78e5f428303223503c9e8a1031143f60f0f585950241368', 'hex');

  describe('Address Derivation and Validation', () => {
    it('should derive a valid unconfidential Liquid SegWit (P2WPKH) address', () => {
      const address = liquidService.deriveLiquidAddress(dummyPubkey, 'mainnet');
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.startsWith('ex1') || address.startsWith('lq1')).toBe(true);
      expect(liquidService.isValidLiquidAddress(address)).toBe(true);
      expect(liquidService.isConfidentialAddress(address)).toBe(false);
    });

    it('should derive a valid confidential Liquid address', () => {
      const unconfidentialAddress = liquidService.deriveLiquidAddress(dummyPubkey, 'mainnet');
      const confidentialAddress = liquidService.deriveConfidentialAddress(unconfidentialAddress, dummyBlindingPubkey);

      expect(confidentialAddress).toBeDefined();
      expect(confidentialAddress).not.toEqual(unconfidentialAddress);
      expect(liquidService.isValidLiquidAddress(confidentialAddress)).toBe(true);
      expect(liquidService.isConfidentialAddress(confidentialAddress)).toBe(true);
    });

    it('should correctly unblind a confidential Liquid address', () => {
      const unconfidentialAddress = liquidService.deriveLiquidAddress(dummyPubkey, 'mainnet');
      const confidentialAddress = liquidService.deriveConfidentialAddress(unconfidentialAddress, dummyBlindingPubkey);

      const unblinded = liquidService.unblindAddress(confidentialAddress);
      expect(unblinded.unconfidentialAddress).toEqual(unconfidentialAddress);
      expect(unblinded.blindingKey.toString('hex')).toEqual(dummyBlindingPubkey.toString('hex'));
    });

    it('should throw an error when attempting to unblind a non-confidential address', () => {
      const unconfidentialAddress = liquidService.deriveLiquidAddress(dummyPubkey, 'mainnet');
      expect(() => liquidService.unblindAddress(unconfidentialAddress)).toThrow(
        '[Liquid] Provided address is not a confidential Liquid address.'
      );
    });

    it('should return false for invalid or empty address strings', () => {
      expect(liquidService.isValidLiquidAddress('')).toBe(false);
      expect(liquidService.isValidLiquidAddress('invalid_address_string')).toBe(false);
      expect(liquidService.isConfidentialAddress('')).toBe(false);
    });
  });

  describe('Peg-In Address Generation', () => {
    it('should generate a valid Liquid peg-in address with federation script', async () => {
      const dummyFedScript = Buffer.from('522102c0fe9234b694c9298e3b5266e7ea818961726a2f7c00e620573024806a0901e12102a1633cafcc01ebf3d78e5f428303223503c9e8a1031143f60f0f58595024136852ae', 'hex');
      const result = await liquidService.generatePegInAddress(dummyPubkey, dummyFedScript, 'mainnet');

      expect(result).toBeDefined();
      expect(result.mainchainAddress).toBeDefined();
      expect(result.claimScript).toEqual(dummyPubkey);
    });

    it('should reject peg-in address generation when federation script is missing', async () => {
      await expect(liquidService.generatePegInAddress(dummyPubkey, '', 'mainnet')).rejects.toThrow(
        '[Liquid] Federation script required for peg-in.'
      );
    });
  });

  describe('Peg-Out Transaction Creation', () => {
    const dummyBtcAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const dummyUtxo: UTXO = {
      txid: 'a000000000000000000000000000000000000000000000000000000000000001',
      vout: 0,
      amount: 100000,
      address: 'ex1qsampleliquidaddress',
      script: '00140000000000000000000000000000000000000000',
      status: 'confirmed',
      isFrozen: false,
      derivationPath: "m/84'/0'/0'/0/0",
      privacyRisk: 'Low'
    };

    it('should construct a valid Base64 encoded peg-out PSET', async () => {
      const psetBase64 = await liquidService.createPegOutTransaction(
        dummyBtcAddress,
        50000,
        liquidService.LBTC_ASSET.mainnet,
        'mainnet',
        [dummyUtxo],
        'lq1qq2xl3s45842c3'
      );

      expect(psetBase64).toBeDefined();
      expect(typeof psetBase64).toBe('string');
      expect(psetBase64.length).toBeGreaterThan(0);
    });

    it('should validate inputs for peg-out transactions', async () => {
      await expect(
        liquidService.createPegOutTransaction('', 50000, liquidService.LBTC_ASSET.mainnet, 'mainnet', [dummyUtxo], 'lq1')
      ).rejects.toThrow('[Liquid] Bitcoin destination address is required for peg-out.');

      await expect(
        liquidService.createPegOutTransaction(dummyBtcAddress, 0, liquidService.LBTC_ASSET.mainnet, 'mainnet', [dummyUtxo], 'lq1')
      ).rejects.toThrow('[Liquid] Peg-out amount must be greater than zero.');
    });
  });

  describe('Production Runtime Guard Enforcement', () => {
    it('should fail closed in production environment mode for peg-in', async () => {
      const dummyFedScript = Buffer.from('522102c0fe9234b694c9298e3b5266e7ea818961726a2f7c00e620573024806a0901e12102a1633cafcc01ebf3d78e5f428303223503c9e8a1031143f60f0f58595024136852ae', 'hex');
      const productionGuard = await import('../services/production-guard');

      expect(() =>
        productionGuard.failClosed('Liquid Peg-In Script Verification', null, true)
      ).toThrow("Guard: Production path for 'Liquid Peg-In Script Verification' is not yet enabled or sync is compromised. Fail-closed enforced.");
    });
  });
});
