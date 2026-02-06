# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

### Added

- **Privacy Scoring Engine**: Dynamic privacy risk assessment based on script types (Taproot), network status (Tor), and UTXO analysis.
- **Physical Backup Audit**: PIN-gated manual verification flow for mnemonic backups against the Secure Enclave.
- **Satoshi AI Privacy Scout**: Context-aware AI assistant that provides proactive privacy and UTXO management advice.
- **Privacy Enclave UI**: Real-time visualization of sovereignty metrics and security recommendations.

### Fixed

- Improved Satoshi AI system prompt for better integration with on-device wallet state.
- Resolved mock logic in Sovereignty Meter quests.

## [0.3.0] - 2026-01-22

### Added

- Android SecureEnclave plugin backed by Android Keystore AES-GCM.
- Optional biometric/device-credential vault gate with authenticated-key protection.
- Vault existence detection and resume logic (use existing wallet if present; otherwise onboarding).
- Offline-safe Tailwind bundling (no CDN dependency) for consistent mobile UI styling.
- Lock screen destructive reset option for creating a new wallet when needed.

### Changed

- SVN version alignment across app, docs, and release hub.
- Lightning backend alignment to LND-only support and safer endpoint handling.
- Persistence sanitization to prevent mnemonic/passphrase from being re-persisted at rest.

### Fixed

- Android Gradle namespace/manifest compatibility issues for modern AGP.
- Test environment polyfills for crypto/TextEncoder/TextDecoder so vault tests run consistently.

### Security

- Session-only seed usage for signing; seed bytes are zeroed after signing operations.
- Reduced risk of accidental secret persistence via state sanitization.
