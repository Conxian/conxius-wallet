import {
  musig2AggregatePubkeysNative,
  musig2SortPubkeysNative,
  musig2GenerateNonceNative,
  musig2AggregateNoncesNative,
  musig2SignPartialNative,
  musig2VerifyPartialNative,
  musig2AggregateSignaturesNative,
} from './enclave-storage';

/**
 * MuSig2 Service (BIP-327, v1.0.4, status: deployed).
 *
 * Coordination layer for interactive n-of-n BIP-340 multi-signatures. The pure
 * BIP-327 crypto (KeyAgg with coefficients, nonce generation/aggregation,
 * partial signing/verification and final aggregation) is performed natively by
 * the `SecureEnclave` Capacitor plugin; this module only tracks session state
 * and sequences the two signing rounds.
 *
 * Byte formats (hex throughout):
 *  - participant public keys are 33-byte compressed keys;
 *  - the aggregate public key is a 32-byte x-only key;
 *  - a pubnonce is 66 bytes, a secnonce is 97 bytes, an aggregate nonce is 66 bytes;
 *  - a partial signature is 32 bytes, the final signature is 64 bytes (BIP-340).
 */

export const MUSIG2_DEFAULT_PATH = "m/86'/0'/0'/0/0";

export interface Musig2Participant {
  id: string;
  publicKey: string; // 33-byte compressed pubkey hex
}

export interface Musig2SessionOptions {
  keyPath?: string;
  network?: string;
}

/** BIP-327 KeyAgg: 32-byte x-only aggregate public key (coefficients included). */
export async function aggregatePubkeys(pubkeys: string[]): Promise<string> {
  const { aggregatePubkey } = await musig2AggregatePubkeysNative({ pubkeys });
  return aggregatePubkey;
}

/** BIP-327 KeySort: canonical lexicographic order of 33-byte compressed keys. */
export async function sortPubkeys(pubkeys: string[]): Promise<string[]> {
  const { sortedPubkeys } = await musig2SortPubkeysNative({ pubkeys });
  return sortedPubkeys;
}

/**
 * A two-round BIP-327 signing session.
 *
 * Participants must be unique-keyed; [Musig2Session.create] sorts them into
 * canonical KeySort order and derives the aggregate key before signing, so
 * nonces, keys and partial signatures are always consumed in one consistent
 * ordering.
 */
export class Musig2Session {
  public readonly id: string;
  public readonly participants: Musig2Participant[];
  public readonly aggregatedPubkey: string;
  public readonly keyPath: string;
  public readonly network: string;

  private secretNonce: string | null = null;
  private publicNonces = new Map<string, string>(); // participantId -> pubnonce hex

  constructor(
    id: string,
    participants: Musig2Participant[],
    aggregatedPubkey: string,
    options: Musig2SessionOptions = {},
  ) {
    this.id = id;
    this.participants = participants;
    this.aggregatedPubkey = aggregatedPubkey;
    this.keyPath = options.keyPath ?? MUSIG2_DEFAULT_PATH;
    this.network = options.network ?? 'mainnet';
  }

  /** Sort participants (KeySort) and derive the aggregate key, returning a ready session. */
  public static async create(
    id: string,
    participants: Musig2Participant[],
    options: Musig2SessionOptions = {},
  ): Promise<Musig2Session> {
    const sortedKeys = await sortPubkeys(participants.map((p) => p.publicKey));
    const byKey = new Map(participants.map((p) => [p.publicKey, p]));
    const sortedParticipants = sortedKeys.map((key) => {
      const participant = byKey.get(key);
      if (!participant) throw new Error("Internal: key ordering lost a participant");
      return participant;
    });
    const aggregatedPubkey = await aggregatePubkeys(sortedKeys);
    return new Musig2Session(id, sortedParticipants, aggregatedPubkey, options);
  }

  /** Round 1: generate this signer's nonce, register it, and return the pubnonce to broadcast. */
  public async generateLocalNonce(
    localParticipantId: string,
    message?: string,
    extra?: string,
  ): Promise<string> {
    const { secnonce, pubnonce } = await musig2GenerateNonceNative({
      path: this.keyPath,
      network: this.network,
      aggpk: this.aggregatedPubkey,
      message,
      extra,
    });
    this.secretNonce = secnonce;
    this.publicNonces.set(localParticipantId, pubnonce);
    return pubnonce;
  }

  /** Register a peer's pubnonce (round 1). */
  public registerNonce(participantId: string, pubnonce: string): void {
    this.publicNonces.set(participantId, pubnonce);
  }

  /** Aggregate all registered pubnonces (BIP-327 NonceAgg) once every participant is present. */
  public async aggregateNonces(): Promise<string> {
    const pubnonces = this.orderedNonces();
    if (pubnonces.length !== this.participants.length) {
      throw new Error(`Missing nonces: have ${pubnonces.length}/${this.participants.length}`);
    }
    const { aggregateNonce } = await musig2AggregateNoncesNative({ pubnonces });
    return aggregateNonce;
  }

  public isReadyToSign(): boolean {
    return this.secretNonce !== null && this.publicNonces.size === this.participants.length;
  }

  /** Round 2: produce this signer's 32-byte partial signature for [message]. */
  public async sign(message: string, aggnonce: string): Promise<string> {
    if (!this.secretNonce) {
      throw new Error("Missing secret nonce: run generateLocalNonce first");
    }
    const { partialSignature } = await musig2SignPartialNative({
      path: this.keyPath,
      network: this.network,
      secnonce: this.secretNonce,
      aggnonce,
      pubkeys: this.orderedPubkeys(),
      message,
    });
    return partialSignature;
  }

  /** Blame-free verification of a peer's partial signature. */
  public async verifyPartial(
    partialSignature: string,
    pubnonce: string,
    pubnonces: string[],
    message: string,
    signerIndex: number,
  ): Promise<boolean> {
    const { valid } = await musig2VerifyPartialNative({
      partialSignature,
      pubnonce,
      pubnonces,
      pubkeys: this.orderedPubkeys(),
      message,
      signerIndex,
    });
    return valid;
  }

  /** Aggregate partial signatures into the final 64-byte BIP-340 signature. */
  public async aggregateSignatures(
    partialSignatures: string[],
    aggnonce: string,
    message: string,
  ): Promise<string> {
    const { signature } = await musig2AggregateSignaturesNative({
      partialSignatures,
      aggnonce,
      pubkeys: this.orderedPubkeys(),
      message,
    });
    return signature;
  }

  private orderedPubkeys(): string[] {
    return this.participants.map((p) => p.publicKey);
  }

  private orderedNonces(): string[] {
    const nonces: string[] = [];
    for (const participant of this.participants) {
      const nonce = this.publicNonces.get(participant.id);
      if (nonce === undefined) break;
      nonces.push(nonce);
    }
    return nonces;
  }
}
