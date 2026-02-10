
import { Signer, UnsignedTransaction, Chain, Network, ChainContext } from '@wormhole-foundation/sdk';
import { SignRequest, SignResult } from './signer';
import { BitcoinLayer } from '../types';

/**
 * ConxiusWormholeSigner
 * Adapts the Conxius Secure Enclave (signer.ts) to the Wormhole SDK Signer interface.
 * 
 * This allows the Wormhole SDK to request signatures for transactions
 * which are then securely signed by the device's TEE/StrongBox via the App's authorization flow.
 */
export class ConxiusWormholeSigner {
  private _chain: Chain;
  private _address: string;
  private _authCallback: (req: SignRequest) => Promise<SignResult>;

  constructor(chain: Chain, address: string, authCallback: (req: SignRequest) => Promise<SignResult>) {
    this._chain = chain;
    this._address = address;
    this._authCallback = authCallback;
  }

  chain(): Chain {
    return this._chain;
  }

  address(): string {
    return this._address;
  }

  /**
   * Sign an array of unsigned transactions.
   * Note: The Conclave usually handles one at a time, so we iterate.
   */
  async sign(txs: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const tx of txs) {
      const { description, transaction } = tx;
      
      // Determine layer based on chain
      let layer: BitcoinLayer | 'Rootstock' | 'Ethereum' = 'Rootstock'; // Default/Fallback
      const chainName = this._chain as string;
      
      if (chainName === 'Bitcoin') layer = 'Mainnet';
      else if (chainName === 'Ethereum') layer = 'Ethereum';
      // Add other chain mappings as needed

      // Request signature via AppContext authorization flow
      // This ensures biometrics/PIN are handled correctly by the central Enclave manager
      const result = await this._authCallback({
          type: 'transaction',
          layer: layer as any, // Cast to match signer types
          payload: transaction,
          description: description || `Sign ${this._chain} Transaction`
      });

      // The SDK expects the signed transaction (often the signature or the signed RLP)
      // If result.broadcastReadyHex is present, that's usually the full signed tx.
      if (result.broadcastReadyHex) {
        signed.push(result.broadcastReadyHex);
      } else {
        // If we only got a signature, we might need to combine it.
        // For now, assume broadcastReadyHex is what we want if available.
        signed.push(result.signature);
      }
    }
    return signed;
  }
}
