import { signNative, getPublicKeyNative } from './enclave-storage';
import { Network } from '../types';
import * as bitcoin from 'bitcoinjs-lib';
import { Web5Service } from './web5';

export interface ConxiusIdentity {
  did: string; // did:pkh:btc:mainnet:<address>
  web5Did?: string; // did:dht:...
  address: string;
  publicKey: string;
}

/**
 * Conxius Identity Service (D.ID)
 * Uses the Secure Enclave as a Hardware Authenticator.
 * Enhanced with Web5 (TBD) support for DWNs and Decentralized Identifiers.
 */
export class IdentityService {
  private network: string;
  private vaultName: string;
  private static cache: Map<string, ConxiusIdentity> = new Map();

  constructor(vaultName: string = 'primary_vault', network: Network = 'mainnet') {
     this.vaultName = vaultName;
     this.network = network;
  }

  /**
   * Retrieves the Decentralized Identifier (DID) for the current vault.
   * Format: did:pkh:btc:<chain_id>:<address>
   * Enhanced with Web5 DID retrieval.
   */
  async getDid(): Promise<ConxiusIdentity> {
     const cacheKey = `${this.vaultName}:${this.network}`;
     if (IdentityService.cache.has(cacheKey)) {
         return IdentityService.cache.get(cacheKey)!;
     }

     // Path: m/84'/0'/0'/0/0 (Standard Native Segwit)
     const path = this.network === 'mainnet' ? "m/84'/0'/0'/0/0" : "m/84'/1'/0'/0/0";

     try {
         let pubkey: string;
         try {
            // Optimization: Try to get public key directly without signing
            const res = await getPublicKeyNative({
                vault: this.vaultName,
                path,
                network: this.network
            });
            pubkey = res.pubkey;
         } catch (e) {
             // Fallback to legacy dummy signature if native method fails
             console.warn("Native getPublicKey failed, falling back to signNative", e);
             const dummyHash = "IDENTITY_PUBKEY_DERIVATION_HASH";
             const res = await signNative({
                 vault: this.vaultName,
                 path,
                 messageHash: dummyHash,
                 network: this.network
             });
             pubkey = res.pubkey;
         }

         const pubkeyBuffer = Buffer.from(pubkey, 'hex');

         // Derive Address (P2WPKH)
         const { address } = bitcoin.payments.p2wpkh({
             pubkey: pubkeyBuffer,
             network: this.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
         });

         if (!address) throw new Error('Failed to derive identity address');

         const chainId = this.network === 'mainnet' ? 'mainnet' : 'testnet';
         const did = `did:pkh:btc:${chainId}:${address}`;

         // Fetch Web5 DID if available
         let web5Did: string | undefined;
         try {
            const web5Service = Web5Service.getInstance();
            web5Did = await web5Service.getDid();
         } catch (err) {
            console.warn("Web5 DID retrieval failed, proceeding with BTC DID only", err);
         }

         const identity = { did, web5Did, address, publicKey: pubkey };
         IdentityService.cache.set(cacheKey, identity);
         return identity;
     } catch (e) {
         console.error("Identity retrieval failed", e);
         throw new Error('Secure Enclave Identity inaccessible');
     }
  }

  /**
   * Signs a "Sign In With X" (SIWx) style message for authentication.
   */
  async signAuthMessage(challenge: string, domain: string): Promise<{ signature: string, message: string }> {
      const timestamp = new Date().toISOString();
      const didInfo = await this.getDid();

      const message = `${domain} wants you to sign in with your Conxius Identity:\n${didInfo.address}\n\nURI: ${didInfo.did}\nWeb5: ${didInfo.web5Did || 'N/A'}\nNonce: ${challenge}\nIssued At: ${timestamp}`;

      const messageHash = Buffer.from(
        bitcoin.crypto.sha256(Buffer.from(message)),
      ).toString("hex");
      const path = this.network === 'mainnet' ? "m/84'/0'/0'/0/0" : "m/84'/1'/0'/0/0";

      const sigRes = await signNative({
          vault: this.vaultName,
          path,
          messageHash,
          network: this.network
      });

      return {
          signature: sigRes.signature,
          message
      };
  }

  /**
   * Performs an LNURL-Auth (LUD-04) login using the Breez SDK.
   */
  async loginWithLightning(lnurl: string): Promise<void> {
      try {
          const { performLnurlAuth } = await import('./breez');
          await performLnurlAuth(lnurl);
          console.log("LNURL-Auth successful");
      } catch (e) {
          console.error("LNURL-Auth failed", e);
          throw new Error('Lightning Authentication failed');
      }
  }
}
