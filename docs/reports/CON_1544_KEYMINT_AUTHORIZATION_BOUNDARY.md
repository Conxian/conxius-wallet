# CON-1544: KeyMint authorization boundary

This slice establishes the wallet-side collection, request-binding, and
client-side Play Integrity token-acquisition boundaries for a future
authorization flow. It does **not** qualify StrongBox on real devices and it
does **not** verify Play Integrity tokens.

## Delivered boundary

- `android/core-crypto` now has typed `KeySecurityTier` values for
  `STRONGBOX`, `TRUSTED_ENVIRONMENT`, `SOFTWARE`, `UNKNOWN`, and
  `UNSUPPORTED`.
- `AuthorizationPolicy.STRONGBOX_REQUIRED` fails closed unless Android exposes
  the explicit StrongBox security level. `TEE_ALLOWED` accepts StrongBox or a
  trusted hardware environment, but never software, unknown, unavailable, or
  unsupported evidence.
- `KeyMintAuthorizationManager` creates a separate P-256/ECDSA Android
  Keystore key with an attestation challenge of 1–128 bytes. Authorization
  aliases must use the manager-owned `ConxiusAuthorizationKey.v1.` namespace;
  wallet seed/database aliases are rejected before inspection. It returns only
  the public key, certificate-chain bytes, key identity, package/signing
  identity, and local `KeyInfo` evidence. The private key is not exported and
  this slice does not add a signing method.
- Every accepted key proves the complete manager profile: EC `secp256r1`
  (P-256), 256-bit size, exact `PURPOSE_SIGN`, exact SHA-256 digest
  authorization, and X.509 leaf-certificate/public-key consistency. Existing
  keys that cannot prove this profile fail closed with stable profile reasons.
- A `TEE_ALLOWED` StrongBox request falls back only for the explicit Android
  `StrongBoxUnavailableException`, and the returned path includes the
  `strongbox_unavailable` reason code. Malformed challenges, evidence
  inspection failures, and other provider failures do not retry. A
  `STRONGBOX_REQUIRED` request never takes that fallback.
- `AuthorizationRequestCanonicalizer` produces a versioned, length-prefixed
  canonical request and SHA-256 `requestHash` binding operation digest, nonce,
  KeyMint challenge, key identity, package name, signing-certificate identity,
  and policy. The existing SHA-256 hash also has a deterministic URL-safe,
  unpadded Base64 transport representation for Standard API request binding.
- `android/app` now consumes the official Google Play Integrity SDK `1.6.0`.
  `PlayIntegrityPlugin` prepares and caches a Standard API token provider for a
  configured Cloud project number, passes the canonical request hash through
  unchanged, and returns only the opaque token.

## API and evidence limits

- On API 26–30, `KeyInfo.isInsideSecureHardware` cannot distinguish StrongBox
  from another trusted hardware environment. The implementation therefore
  never promotes that signal to `STRONGBOX`; StrongBox-required requests are
  not accepted from that evidence.
- Unknown or unavailable local evidence is rejected before it can be returned
  as policy-accepted authorization evidence. The typed evidence boundary does
  not make a local decision from a Play Integrity token or use a web fallback.
- `SECURITY_LEVEL_UNKNOWN_SECURE` remains an unknown tier in this boundary; it
  is not silently promoted to StrongBox or TEE evidence.
- Play Integrity tokens remain opaque. Client SDK/token acquisition is present,
  but this slice includes no token decoding, on-device verdict trust, replay
  protection, package verification, or server verification. Backend decryption,
  verdict verification, request-hash comparison, replay/freshness trust policy,
  and production enforcement remain pending.
- Existing AES seed/database storage behavior is unchanged. The new key is not
  wired into wallet unlock, Bitcoin/Stacks signing, secp256k1/Schnorr paths, or
  any production gate.

## Qualification blockers

Real-device qualification still requires independently captured evidence from
StrongBox-capable, TEE-only, unsupported, and relevant Play-installed states.
The backend still must decrypt and verify KeyMint/Play Integrity evidence,
compare the server-computed request hash, define replay/freshness trust policy,
and explicitly approve any production enforcement. The repository-side tests
cover deterministic policy, binding, and client pass-through behavior; they are
not a substitute for that hardware and backend qualification.
