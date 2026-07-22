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
  Keystore key with an attestation challenge. It returns only the public key,
  certificate-chain bytes, key identity, package/signing identity, and local
  `KeyInfo` evidence. The private key is not exported and this slice does not
  add a signing method.
- A `TEE_ALLOWED` StrongBox-generation failure is returned as an explicit
  `TRUSTED_ENVIRONMENT_FALLBACK` path with a reason code. A
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
- Play Integrity tokens remain opaque. Client SDK/token acquisition is present,
  but backend decryption, verdict verification, request-hash comparison,
  replay/freshness trust policy, and production enforcement remain pending.
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
