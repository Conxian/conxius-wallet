# Sentinel Journal 🛡️

## 2025-05-14 - Incomplete Duress Mode Protection
**Vulnerability:** The "Duress PIN" feature only reset the in-memory application state, leaving the encrypted master seed and wallet data (BIP-39 entropy) intact on the device's persistent storage.
**Learning:** In physical coercion scenarios, merely hiding data from the UI is insufficient. An adversary with physical access to the device can still discover the encrypted blob in `localStorage` or the native enclave. If the duress mechanism doesn't include actual data erasure, the security promise of a "panic" PIN is partially broken, as the data remains vulnerable to future extraction or brute-force attacks.
**Prevention:** Duress or "panic" mechanisms must prioritize the destruction of the root of trust (the master seed/entropy) from all persistent storage layers (Native Enclave, LocalStorage, SessionStorage) to ensure the data is irrecoverable.

## 2025-05-15 - Native Session Cache and UI Leakage
**Vulnerability:** The native Android enclave utilized a performance-focused session cache that was not explicitly cleared when the wallet was "locked" from the JS layer. Additionally, the application lacked `FLAG_SECURE`, allowing sensitive wallet UI to be captured in screenshots and the task switcher.
**Learning:** High-level "lock" states in the UI must have corresponding "wipe" operations in the native/secure layer. If a session cache exists for performance, it must be bound to the same lifecycle as the UI lock. Security requirements from the PRD (like `FLAG_SECURE`) must be verified in the native entry point (MainActivity), not just assumed from the framework.
**Prevention:** Always implement `FLAG_SECURE` in the `onCreate` of the `MainActivity` for sovereign wallets. Ensure that any `clearSession` or `lock` method explicitly zeroes out sensitive byte arrays (using `Arrays.fill`) and nullifies key references in memory.
