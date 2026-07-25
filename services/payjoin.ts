import { parseBip21 } from './bip21';
import { Network } from '../types';

export class PayJoinService {
  constructor(networkParam: Network = 'mainnet') {
    void networkParam;
  }

  /**
   * Checks if a BIP-21 URI contains a PayJoin endpoint.
   */
  hasPayJoin(uri: string): boolean {
    const parsed = parseBip21(uri);
    return !!parsed.options?.pj;
  }

  /**
   * Quarantined until receiver negotiation, native signing, finalization, and
   * broadcast are all bound to one exact App-private value-operation request.
   */
  async sendPayJoin(uri: string): Promise<never> {
    void uri;
    throw new Error('PAYJOIN_QUARANTINED: exact receiver proposal, native signature, finalization, and broadcast authority are unavailable');
  }
}
