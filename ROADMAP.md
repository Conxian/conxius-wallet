# Conxius Wallet Roadmap

## Product Goals

- Offline-first, mobile-first Bitcoin + L2 wallet with a hardened local enclave model
- Minimal trust assumptions: keys never leave device; network calls are explicit and user-controlled
- Clear recovery model: PIN + optional device auth gate + seed backup flows

## Current State (Implemented)

- Encrypted state vault with PIN-based encryption and migration from legacy formats
- Android SecureEnclave Capacitor plugin backed by Android Keystore (AES-GCM)
- Optional biometric/device-credential gate for vault encryption (auth-bound key; v1→v2 migration)
- Auto-lock, duress PIN, and session-only seed usage for signing
- On-chain send (PSBT build, enclave signing, broadcast) and LN invoice/LNURL parsing

## Near-Term (Next Iteration)

- Local notifications
  - Transaction status: broadcast submitted, confirmed, failed
  - Security events: auto-lock triggered, biometric session expired, vault write blocked by auth
- Wallet lifecycle
  - “Wallet exists” UX: resume existing wallet by default, explicit “create new” flow
  - Backup reminders: periodic prompt to confirm seed backup and test restore
- Performance & UX
  - Reduce bundle size and improve first-load time
  - Mobile typography/spacing tuning and skeleton loaders

## Mid-Term

- Multi-account / multi-wallet support (separate vault slots; explicit switching)
- Background sync primitives (opt-in)
  - Balance polling with rate limits
  - Local pending-transaction tracking
- Enhanced Lightning
  - Improve backend configuration UX and status checks
  - Add robust payment result handling and retries

## Long-Term

- Push notifications (FCM) for server-assisted updates (opt-in)
- Hardware-backed security upgrades
  - Strongbox where available
  - More granular per-operation auth (signing prompts, high-value thresholds)
- iOS parity (future iteration)
  - Keychain/Secure Enclave plugin + biometric gate

## Engineering Notes

- Notification strategy
  - Phase 1: Capacitor Local Notifications (on-device only)
  - Phase 2: FCM push for remote triggers (requires server component and privacy review)
