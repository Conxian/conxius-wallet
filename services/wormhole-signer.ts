
import { UnsignedTransaction, Chain } from '@wormhole-foundation/sdk';
import { ValueOperationAuthorizer } from './value-operation';
import { assertTrustedValueOperationCapabilityConsumer } from './app-private/value-operation-authority';

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
  private _authorizeValueOperation: ValueOperationAuthorizer;

  constructor(chain: Chain, address: string, authorizeValueOperation: ValueOperationAuthorizer) {
    this._chain = chain;
    this._address = address;
    this._authorizeValueOperation = authorizeValueOperation;
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
    assertTrustedValueOperationCapabilityConsumer(this._authorizeValueOperation.consumer);
    void txs;
    throw new Error('WORMHOLE_SIGNING_QUARANTINED: exact canonical transaction binding and native Wormhole signing semantics are unavailable');
  }
}
