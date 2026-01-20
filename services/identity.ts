import { signNative } from './enclave-storage';
import { Network } from '../types';
import * as bitcoin from 'bitcoinjs-lib';

export interface ConxiusIdentity {
  did: string; // did:pkh:btc:mainnet:<address>
  address: string;
  publicKey: string;
}

/**
 * Conxius Identity Service (D.ID)
 * Uses the Secure Enclave as a Hardware Authenticator.
 */
export class IdentityService {
  private network: string;
  private vaultName: string;

  constructor(vaultName: string = 'primary_vault', network: Network = 'mainnet') {
     this.vaultName = vaultName;
     this.network = network;
  }

  /**
   * Retrieves the Decentralized Identifier (DID) for the current vault.
   * Format: did:pkh:btc:<chain_id>:<address>
   * Current implementation uses the Bitcoin Mainnet/Testnet address as the anchor.
   */
  async getDid(): Promise<ConxiusIdentity> {
     // We request a signature of a deterministic "ID Salt" to derive/retrieve the public key
     // without needing to store it loosely. 
     // Path: m/84'/0'/0'/0/0 (Standard Native Segwit)
     
     // Note: In a real "Zero-Knowledge" setup, we might use a different path for Identity (e.g. m/73'/...)
     // to keep funds and identity separate. For "Sovereign Business", using the Master Address 
     // as the Identity Anchor is the most compatible with existing tools (like verifyMessage).
     
     const path = this.network === 'mainnet' ? "m/84'/0'/0'/0/0" : "m/84'/1'/0'/0/0";
     
     // We use a dummy hash to get the pubkey from the enclave if we don't have it.
     // Ideally, we should add `getPublicKey` to the Enclave plugin to avoid signing.
     // Optimization: Usage of signNative to retrieve pubkey.
     const dummyHash = "0000000000000000000000000000000000000000000000000000000000000000";
     
     try {
         const res = await signNative({
             vault: this.vaultName,
             path,
             messageHash: dummyHash,
             network: this.network
         });
         
         const pubkey = res.pubkey;
         const pubkeyBuffer = Buffer.from(pubkey, 'hex');
         
         // Derive Address (P2WPKH)
         const { address } = bitcoin.payments.p2wpkh({
             pubkey: pubkeyBuffer,
             network: this.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
         });
         
         if (!address) throw new Error('Failed to derive identity address');
         
         const chainId = this.network === 'mainnet' ? 'mainnet' : 'testnet'; 
         const did = `did:pkh:btc:${chainId}:${address}`;
         
         return { did, address, publicKey: pubkey };
     } catch (e) {
         console.error("Identity retrieval failed", e);
         throw new Error('Secure Enclave Identity inaccessible');
     }
  }

  /**
   * Signs a "Sign In With X" (SIWx) style message for authentication.
   * @param challenge A server-provided nonce or message.
   * @param domain The domain requesting login.
   */
  async signAuthMessage(challenge: string, domain: string): Promise<{ signature: string, message: string }> {
      const timestamp = new Date().toISOString();
      const didInfo = await this.getDid();
      
      const message = `${domain} wants you to sign in with your Conxius Identity:\n${didInfo.address}\n\nURI: ${didInfo.did}\nNonce: ${challenge}\nIssued At: ${timestamp}`;
      
      const messageHash = bitcoin.crypto.sha256(Buffer.from(message)).toString('hex');
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
   * This is a passwordless login mechanism for Lightning services.
   */
  async loginWithLightning(lnurl: string): Promise<void> {
      try {
          // Dynamic import to avoid circular dependencies if any
          const { performLnurlAuth } = await import('./breez');
          await performLnurlAuth(lnurl);
          console.log("LNURL-Auth successful");
      } catch (e) {
          console.error("LNURL-Auth failed", e);
          throw new Error('Lightning Authentication failed');
      }
  }
}
