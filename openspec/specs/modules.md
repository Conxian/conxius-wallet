---
title: Modules
layout: page
permalink: /./openspec/specs/modules
---

# Module Specification (v1.9.5)

## Android Native Modules
- **:core-crypto**: Kotlin. Android Keystore AES-GCM with StrongBox-first provisioning and explicit TEE fallback for existing storage, biometric integration, mnemonic zeroing, and a separate P-256 KeyMint authorization boundary whose qualification remains pending.
- **:core-bitcoin**: Kotlin/BDK. Descriptor management (BIP-84/86), PSBT signing, Esplora sync.
- **:core-database**: Kotlin/Room. Encrypted via SQLCipher with an Android Keystore-protected passphrase; StrongBox is requested where supported and the existing path can fall back to TEE.
- **:app**: Kotlin/Jetpack Compose. WalletViewModel, Sovereignty Meter, UI State management.

The [CON-1544 qualification report](../../docs/reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md)
defines the KeyMint/StrongBox and Play Integrity client/backend boundary. It
does not qualify protocol signing keys or production value-operation enforcement.

## Cross-Platform Services (TS/JS Layer)
- **Sovereign AI**: BYOS support, mandatory `secureAuditPrompt` redaction.
- **Bridge Service**: Sovereign Bridge Protocol, NTT transceiver integration.
- **Nostr Service**: NIP-47 (NWC) for remote control quorums.
- **Smart Wallet Engine**: Miniscript policy auditor, Musig2 session management.
