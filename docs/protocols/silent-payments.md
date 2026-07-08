# Silent Payments (BIP-352) Implementation

Conxius Wallet implements BIP-352 to provide static, non-linkable receive addresses for Bitcoin.

## Architecture

Silent Payments follow the **Bridged Sovereign Architecture**:
1. **TS Layer**: Handles BIP-32 key derivation (m/352') and high-level UX.
2. **Native Layer**: `SilentPaymentManager.kt` provides optimized scanning and bech32m encoding.
3. **Enclave**: Scan and Spend keys are protected by the Android Keystore.

## Key Derivation
- **Scan Key**: `m/352'/0'/0'/10/0`
- **Spend Key**: `m/352'/0'/0'/10/1`

## Native Scanning Loop
The scanning loop in native Kotlin allows for high-performance block processing without blocking the main UI thread. It utilizes BIP-158 block filters to identify candidate transactions before performing the Elliptic Curve DH exchange.

## Security Guards
All native scanning operations are protected by `ProductionRuntimeGuard.failClosed()`.

---
*Verified by v1.9.5 Production Audit.*
