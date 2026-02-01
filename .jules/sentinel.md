# Sentinel Journal 🛡️

## 2025-05-14 - Incomplete Duress Mode Protection
**Vulnerability:** The "Duress PIN" feature only reset the in-memory application state, leaving the encrypted master seed and wallet data (BIP-39 entropy) intact on the device's persistent storage.
**Learning:** In physical coercion scenarios, merely hiding data from the UI is insufficient. An adversary with physical access to the device can still discover the encrypted blob in `localStorage` or the native enclave. If the duress mechanism doesn't include actual data erasure, the security promise of a "panic" PIN is partially broken, as the data remains vulnerable to future extraction or brute-force attacks.
**Prevention:** Duress or "panic" mechanisms must prioritize the destruction of the root of trust (the master seed/entropy) from all persistent storage layers (Native Enclave, LocalStorage, SessionStorage) to ensure the data is irrecoverable.

## 2025-05-15 - Persistent Session Leakage & Secret Exposure
**Vulnerability:** The native "Fast Path" session cache (master seed derived key) was not cleared upon an explicit wallet lock, and the Gemini API key was being hardcoded into the production JS bundle via Vite's `define` plugin.
**Learning:** Performance optimizations (like session caching) and build-time convenience (injecting keys) often create silent security gaps. A "Lock" action must be holistic, clearing all layers of memory, including native plugin caches. Furthermore, frontend "defined" variables are string literals in the final bundle, making them trivial to extract.
**Prevention:** Always verify that "Lock" or "Logout" events propagate to all sensitive memory caches. Never use build-time injection for secrets intended for the client side; use runtime configuration or backend proxies.
