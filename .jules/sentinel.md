---
title: Sentinel Journal 🛡️
layout: page
permalink: /sentinel
---

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

## 2026-02-14 - [Build Alignment and Type Safety in Bridge SDKs]
**Issue:** Major documentation and code alignment uncovered multiple TypeScript compilation errors in cross-chain (Wormhole) and swap (Boltz) services due to breaking changes in library versions (bitcoinjs-lib v7) and missing SDK argument overloads.
**Learning:** Documentation alignment is a powerful tool for discovering technical debt. "Production-ready" labels in PRDs can mask underlying build failures if not strictly verified with a full `npm run build` or `tsc`. Library upgrades (like bitcoinjs-lib v6 to v7) often introduce subtle breaking changes in cryptographic hashing methods (e.g., `hashForTaprootSignature` becoming `hashForWitnessV1`) that require careful re-implementation.
**Prevention:** Always verify documentation updates against a successful clean build (`npm run build`). Use explicit type wrapping (e.g., `Buffer.from()`) when bridging between standard `Uint8Array` and library-specific `Buffer` types to prevent runtime panics and compilation errors.

## 2026-05-21 - [CSPRNG Uniformity and Comprehensive Memory Scrubbing]
**Vulnerability:** Multiple services used `Math.random()` for generating IDs, and components failed to zero-fill decrypted sensitive buffers if operations occurred outside specific hardening blocks.
**Learning:** In a security-sensitive app, inconsistent use of CSPRNG creates "soft spots" where randomness could be predicted. Furthermore, memory hardening must be comprehensive; every instance where a secret (like a decrypted seed) is materialised in RAM as a `Uint8Array` must have a corresponding `.fill(0)` in a `finally` block, even if the buffer is only used for a transient check or display.
**Prevention:** Enforce a project-wide ban on `Math.random()` for any ID generation or logic, mandating `globalThis.crypto.getRandomValues()`. Audit all calls to decryption services (`decryptSeed`) and ensure the resulting buffers are zeroed in `finally` blocks.

## 2026-05-22 - [Sensitive Material in Worker Cache Keys]
**Vulnerability:** The `crypto.worker.ts` utilized plaintext mnemonics and seeds as keys in its internal `Map` caches (`pbkdf2Cache` and `nodeCache`). While the values (buffers) were zeroed on lock, the mnemonics persisted in memory as string-based keys.
**Learning:** Security hardening must extend beyond the values being stored to the keys themselves. Using sensitive material as a lookup key effectively creates a secondary, long-lived storage of that secret in the heap.
**Prevention:** Always hash sensitive material (SHA-256) before using it as a cache key or lookup identifier. Ensure that any intermediate plaintext strings are garbage-collected by nullifying references immediately after the hash is generated.

## 2026-05-22 - [CSPRNG Uniformity and ESM Resolution in Security Modules]
**Vulnerability:** Ark and RGB service modules utilized `Math.random()` for VTXO ID generation and asset discovery counts, violating the project's sovereign randomness policy. Additionally, `services/ecc.ts` failed to resolve `@noble/curves` sub-paths in the Vitest environment due to missing file extensions in imports.
**Learning:** Even "simulated" or mock logic in a security-critical application must adhere to CSPRNG standards to prevent any predictability in the system's state. Furthermore, security modules using modern ESM libraries (like `@noble/curves`) must use explicit `.js` extensions in sub-path imports to ensure cross-environment compatibility between Vite, Node.js, and Vitest.
**Prevention:** Audit all randomness usage and mandate `globalThis.crypto.getRandomValues()`. Always include `.js` extensions for sub-path imports in ESM-first security libraries to prevent resolution failures during testing and production builds.

## 2026-05-22 - [Centralized CSPRNG for Identifiers and Tokens]
**Vulnerability:** Multiple services (`swap.ts`, `coinjoin.ts`, `network.ts`) utilized `Math.random().toString(36)` for generating critical identifiers like swap IDs, registration tokens, and Tor circuit IDs, making them potentially predictable.
**Learning:** Relying on `Math.random()` for any identifier that interacts with external services or multi-party protocols (like CoinJoin or Tor) creates a security weakness. Centralizing cryptographically secure random string generation into a single utility ensures consistency and facilitates project-wide security audits.
**Prevention:** Implement a centralized `generateRandomString` utility backed by `globalThis.crypto.getRandomValues()` and mandate its use for all random alphanumeric identifiers, replacing all legacy `Math.random()` calls.

## 2026-05-22 - [Modulo Bias in Random String Generation]
**Vulnerability:** The `generateRandomString` utility used the modulo operator (`%`) on random bytes to select characters from a 36-char charset. Since 256 is not a multiple of 36, this introduced a statistical bias where the first four characters were ~14% more likely to appear.
**Learning:** Cryptographically secure randomness requires more than just a secure source (like `crypto.getRandomValues`); it also requires uniform mapping to the target space. Simple modulo on non-power-of-two ranges always introduces bias.
**Prevention:** Use rejection sampling when mapping random bytes to a range that does not evenly divide the byte's maximum value (e.g., 256). Discard values that fall into the biased "tail" and retry.

## 2026-05-23 - [CWE-312: Cleartext Mnemonic in DOM and Enhanced Log Sanitization]
**Vulnerability:** The onboarding process rendered the plaintext BIP-39 mnemonic in the DOM, even when it was visually blurred using CSS. Additionally, the centralized error sanitization logic lacked specific patterns for detecting and redacting mnemonics and private keys.
**Learning:** Visual masking (like CSS blur) is insufficient for high-entropy secrets if the underlying data remains in the DOM tree, where it can be captured by browser extensions or local exploits. Furthermore, log sanitization must be proactive; standard patterns for "internal" or "rpc" errors are not enough to prevent leakage of the wallet's root of trust if a protocol service fails while handling sensitive material.
**Prevention:** Always use conditional rendering for secrets in React. If a secret is hidden, its value must be replaced with placeholders (e.g., "••••") in the JS logic before it hits the DOM. In the network layer, maintain a robust regex blacklist in `sanitizeError` that specifically targets BIP-39 phrases (12+ words) and 64-character hex strings to ensure defense-in-depth against credential leakage.

## 2026-05-24 - [CSPRNG for Attestation Nonces and Regression Testing]
**Vulnerability:** The `ensureDeviceSafety` function utilized `Math.random()` to generate nonces for Google Play Integrity attestation. Predictable nonces weaken the defense against replay attacks in remote attestation flows.
**Learning:** Even if a service is "supporting" or "meta-security" (like device attestation), its internal entropy requirements must meet the same standards as the primary wallet logic. Furthermore, high-priority security logic (like the regex-based `sanitizeError` blacklist) requires explicit unit tests to prevent silent regressions during refactoring, even if the implementation appears correct.
**Prevention:** Mandate the use of `generateRandomString` (backed by `crypto.getRandomValues`) for all nonces and identifiers. Always accompany security-critical regex patterns with comprehensive test suites that verify both positive matches (redaction) and negative matches (legitimate messages).

## 2026-02-18 - [Blind Spots in Error Sanitization]
**Vulnerability:** The centralized `sanitizeError` utility only inspected specific top-level properties (`message`, `statusText`), allowing sensitive material (mnemonics, keys) to leak if nested within custom error fields like `reason` or `error`.
**Learning:** Partial inspection of error objects is insufficient for "Zero-Leak" security. Third-party SDKs and different RPC providers use non-standard property names for error details, which can bypass simple property-based filters.
**Prevention:** Always serialize the entire error object (via `JSON.stringify`) to perform a full-text scan for sensitive patterns before allowing any part of the error to be returned to the UI or logs. Combine this with multi-field extraction for safe fallback display.
