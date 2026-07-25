
import { UnsignedTransaction, Chain } from '@wormhole-foundation/sdk';
import { BitcoinLayer } from '../types';
import {
  createUnverifiedValueOperationRequest,
  createValueOperationNonce,
  ValueOperationOutcome,
  ValueOperationRequest,
  valueOperationOutcomeMessage,
} from './value-operation';

/**
 * ConxiusWormholeSigner
* Adapts Wormhole transaction requests to the wallet-owned value-operation gate.
 * 
* The gate remains fail-closed until wallet-owned authoritative evidence verification
* and native signing are available; this class never falls back to browser signing.
 */
export class ConxiusWormholeSigner {
  private _chain: Chain;
  private _address: string;
  private _authCallback: (req: ValueOperationRequest) => Promise<ValueOperationOutcome>;

  constructor(chain: Chain, address: string, authCallback: (req: ValueOperationRequest) => Promise<ValueOperationOutcome>) {
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
      const result = await this._authCallback(createUnverifiedValueOperationRequest({
          operationType: 'bridge',
          chainLayer: layer,
          payload: transaction,
          network: 'mainnet',
          purpose: 'wormhole.sign-transaction',
          nonce: createValueOperationNonce(),
          audience: 'wormhole-sdk',
          keyIdentity: `wallet.wormhole.${chainName.toLowerCase()}`,
          algorithm: chainName === 'Bitcoin' ? 'secp256k1-ecdsa' : 'secp256k1-ecdsa-recoverable',
          signingType: 'psbt',
          description: description || `Sign ${this._chain} Transaction`,
      }));

      if (result.status !== 'allowed') throw new Error(valueOperationOutcomeMessage(result));

      const broadcastReadyHex = result.signature?.broadcastReadyHex;
      if (!broadcastReadyHex) throw new Error('Wormhole signing produced no authoritative signed transaction.');
      signed.push(broadcastReadyHex);
    }
    return signed;
  }
}
