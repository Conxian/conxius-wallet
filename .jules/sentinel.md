# Sentinel Journal 🛡️

## 2025-05-14 - Incomplete Duress Mode Protection
**Vulnerability:** The "Duress PIN" feature only reset the in-memory application state, leaving the encrypted master seed and wallet data (BIP-39 entropy) intact on the device's persistent storage.
**Learning:** In physical coercion scenarios, merely hiding data from the UI is insufficient. An adversary with physical access to the device can still discover the encrypted blob in `localStorage` or the native enclave. If the duress mechanism doesn't include actual data erasure, the security promise of a "panic" PIN is partially broken, as the data remains vulnerable to future extraction or brute-force attacks.
**Prevention:** Duress or "panic" mechanisms must prioritize the destruction of the root of trust (the master seed/entropy) from all persistent storage layers (Native Enclave, LocalStorage, SessionStorage) to ensure the data is irrecoverable.

## 2025-05-15 - Native Session Cache and UI Leakage
**Vulnerability:** The native Android enclave utilized a performance-focused session cache that was not explicitly cleared when the wallet was "locked" from the JS layer. Additionally, the application lacked `FLAG_SECURE`, allowing sensitive wallet UI to be captured in screenshots and the task switcher.
**Learning:** High-level "lock" states in the UI must have corresponding "wipe" operations in the native/secure layer. If a session cache exists for performance, it must be bound to the same lifecycle as the UI lock. Security requirements from the PRD (like `FLAG_SECURE`) must be verified in the native entry point (MainActivity), not just assumed from the framework.
**Prevention:** Always implement `FLAG_SECURE` in the `onCreate` of the `MainActivity` for sovereign wallets. Ensure that any `clearSession` or `lock` method explicitly zeroes out sensitive byte arrays (using `Arrays.fill`) and nullifies key references in memory.
## 2024-05-22 - [Critical] Hardcoded API Keys in Build Config
**Vulnerability:** Gemini API keys were hardcoded in `vite.config.ts` and injected into the client bundle via `define`. This exposed the key to anyone with access to the build artifacts or the browser console.
**Learning:** Build-time environment variable injection (`define` in Vite) is a common but dangerous pattern for secrets. Even if the source code is private, the compiled JS is often public or accessible to users.
**Prevention:** Use a "Bring Your Own Key" (BYOK) model for sensitive third-party services. Store keys in encrypted application state rather than environment variables or build configs. Synchronize the key to the service layer at runtime.

## 2025-05-20 - Keyboard Caching and Sensitive Input Leakage
**Vulnerability:** Sensitive input fields—including BIP-39 mnemonic phrases, Enclave PINs, and Gemini AI API keys—lacked attributes to disable browser and mobile keyboard features like autocorrect, suggestions, and caching.
**Learning:** On mobile devices, third-party keyboards (Gboard, SwiftKey) often cache and sync text entered into standard `input` and `textarea` fields to the cloud for "personalization." If these fields are not explicitly hardened, a user's master seed or PIN can be leaked to the keyboard provider's servers. Even with `type="password"`, explicitly setting security attributes is necessary to ensure consistent behavior across different browsers and platforms.
**Prevention:** Always apply `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, and `spellCheck="false"` to any UI element that handles secrets, recovery phrases, or authentication material.

## 2026-02-06 - [Zero-Memory Hardening and State Purging]
**Vulnerability:** Sensitive application state (including Gemini API keys, UTXO lists, and asset balances) persisted in React memory even when the wallet was in a "Locked" state. Additionally, recovery phrases remained in component state after being hidden from the UI.
**Learning:** High-level UI lock states are often insufficient if the underlying application state is not explicitly purged. An attacker with access to a running process or a memory dump could extract sensitive data from a locked wallet.
**Prevention:** Centralize locking logic into a "Zero-Memory" function that explicitly resets sensitive state variables to their defaults (while preserving non-sensitive user preferences). Always nullify secret strings (like mnemonics) in component state as soon as they are no longer actively displayed.

## 2026-03-10 - [Export Sanitization and CI Resource Optimization]
**Vulnerability:** The "Export Vault JSON" feature leaked plain-text secrets (Gemini API keys, LND keys, Duress PINs) by serializing the entire application state. Additionally, the CI pipeline used unverified security scanning flags and fragmented jobs, increasing resource overhead and external hit risks.
**Learning:** Application exports intended for backup often bundle more than the user expects. If the export is not explicitly sanitized, it can transform a secure enclave into a plaintext leak. In CI, using high-overhead security tools with external verification can trigger billing or rate-limit locks if not optimized.
**Prevention:** Always implement a dedicated sanitization pass before serializing state for export. Consolidate CI jobs and optimize security scan flags (e.g., removing --only-verified) to balance security depth with resource availability.

## 2026-05-20 - [CSPRNG for Verification and Defensive State Purging]
**Vulnerability:** Mnemonic verification indices were selected using `Math.random()`, which is predictable and not suitable for security-critical flows. Additionally, sensitive state-clearing logic in the onboarding process was placed outside of error-handling blocks, potentially leaving secrets in memory if an exception occurred during wallet finalization.
**Learning:** In financial applications, every randomized decision (even UI-level ones like verification index selection) must use a CSPRNG (`globalThis.crypto.getRandomValues()`). Furthermore, "Zero-Leak" memory hardening requires that cleanup logic be placed in `finally` blocks to ensure execution regardless of the success or failure of sensitive operations.
**Prevention:** Always use `crypto.getRandomValues()` for any security-related randomness. Wrap all secret-handling logic in `try...finally` blocks and perform state purging and memory scrubbing within the `finally` block.

## 2026-05-20 - [CSPRNG for Verification, NTT Mocks, and Defensive State Purging]
**Vulnerability:** Mnemonic verification indices and experimental NTT transaction hashes were generated using `Math.random()`, which is predictable and not suitable for security-critical flows. Additionally, sensitive state-clearing logic in the onboarding process was placed outside of error-handling blocks, potentially leaving secrets in memory if an exception occurred during wallet finalization.
**Learning:** In financial applications, every randomized decision (even UI-level ones like verification index selection or mock hash generation) must use a CSPRNG (`globalThis.crypto.getRandomValues()`). Furthermore, "Zero-Leak" memory hardening requires that cleanup logic be placed in `finally` blocks to ensure execution regardless of the success or failure of sensitive operations. Consolidating CI to remove heavy external security tools while maintaining high-severity local audits helps avoid resource exhaustion and billing locks.
**Prevention:** Always use `crypto.getRandomValues()` for any security-related randomness. Wrap all secret-handling logic in `try...finally` blocks and perform state purging and memory scrubbing within the `finally` block. Optimize CI by focusing on core verification steps (lint, build, test, high-severity audit).
