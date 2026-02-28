# Native Protocol Alignment Report: Conxius Wallet

**Date:** 2026-02-28
**Subject:** Assessment of Protocol Migration to Pure Native (Kotlin/Rust)

## 1. Lightning Protocol (Breez SDK)
- **Status:** READY FOR MIGRATION (P0)
- **Technical Path:** Use the `breez-sdk-android` library.
- **Benefits:** Eliminates the Capacitor JNI overhead. Provides background sync for payments via Android WorkManager.

## 2. Liquid Sidechain (GDK)
- **Status:** READY FOR MIGRATION (P0)
- **Technical Path:** Use `libwally` and `gdk-android`.
- **Benefits:** Direct access to confidential transaction math and hardware-aligned signing.

## 3. Ark & RGB (Rust with JNI)
- **Status:** ACTIVE DEVELOPMENT (P1)
- **Technical Path:** Use `ark-lib` and `rgb-lib` (Rust crates) bridged via UniFFI or JNI.
- **Benefits:** Client-side validation is computationally heavy; native Rust execution is 10-50x faster than WASM in a Webview.

## 4. Web5 & Nostr
- **Status:** HYBRID (P2)
- **Technical Path:** Maintain existing TypeScript services via a minimal "Headless Webview" until the Kotlin SDKs (`web5-kt`, `nostr-kt`) reach feature parity.
- **Benefits:** Rapid development of decentralized identity while maintaining the security of the native signing enclave.

## 5. Bitcoin L1 (BDK)
- **Status:** COMPLETED (SVN 1.5)
- **Technical Path:** Fully integrated `bdk-android`.
- **Outcome:** Proven success in native PSBT handling and address derivation.

## Recommendation
Conxius should prioritize the migration of **Lightning** and **Liquid** next to unify the "Bitcoin Trinity" (L1, LN, Liquid) in the native layer. This ensures the best performance for the most common user actions.
