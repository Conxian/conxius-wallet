import type {
  ValueOperationAuthorization,
  ValueOperationBroadcastAuthorization,
  ValueOperationOutcome,
  ValueOperationRequest,
  ValueOperationSettlementAuthorization,
  ValueOperationSettlementSubmission,
} from './value-operation';
import type { SignResult } from './signer';

/**
* App-issued, consume-only capability boundary.
*
* This module intentionally has no runtime exports. The App-private authority
* owns the implementation and closure state; feature code receives only an
* instance of this interface through the App-owned authorizer callback.
*/
export interface ValueOperationCapabilityConsumer {
  isIssuedAuthorization(authorization: ValueOperationAuthorization): boolean;
  requireSignature(outcome: ValueOperationOutcome, request?: ValueOperationRequest): SignResult;
  requireSettlementAuthorization(
    outcome: ValueOperationOutcome,
    request: ValueOperationRequest,
  ): ValueOperationSettlementAuthorization;
  consumeBroadcastAuthorization(
    authorization: ValueOperationBroadcastAuthorization,
    submission: { signedHex: string; layer: string; network: string; now?: Date },
  ): void;
  consumeSettlementAuthorization(submission: ValueOperationSettlementSubmission): void;
}
