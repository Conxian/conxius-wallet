# Proposal: FDC3 Native Intent Resolver (CON-1181)

**Status:** DRAFT
**Context:** Institutional Interoperability

## 1. Objective
Provide a native Android intent resolver for FDC3 intents (SignPayload, ViewAsset) to bridge the gap between desktop-first FDC3 and mobile sovereign signing.

## 2. Implementation
- **Intent Filter**: Register `com.conxius.wallet.FDC3_INTENT` in `AndroidManifest.xml`.
- **Bridge**: A custom `Fdc3Plugin` in Capacitor to receive and dispatch intents to the native `SecureEnclave`.
- **Payload**: Standardized FDC3 2.0 context objects.

## 3. Security
- All FDC3 payloads must be audited by `AiSecurityService` (stripping PII) before being presented to the user.
- Signature requests must originate from verified corporate domains.
