# Module Specification (v1.6.0)

## Android Native Modules
- **:core-crypto**: Kotlin. StrongBox-backed AES-GCM, biometric integration, mnemonic zeroing.
- **:core-bitcoin**: Kotlin/BDK. Descriptor management (BIP-84/86), PSBT signing, Esplora sync.
- **:core-database**: Kotlin/Room. Encrypted via SQLCipher with StrongBox-managed passphrase.
- **:app**: Kotlin/Jetpack Compose. WalletViewModel, Sovereignty Meter, UI State management.

## Cross-Platform Services (TS/JS Layer)
- **Sovereign AI**: BYOS support, mandatory `secureAuditPrompt` redaction.
- **Bridge Service**: Sovereign Bridge Protocol, NTT transceiver integration.
- **Nostr Service**: NIP-47 (NWC) for remote control quorums.
- **Smart Wallet Engine**: Miniscript policy auditor, Musig2 session management.
