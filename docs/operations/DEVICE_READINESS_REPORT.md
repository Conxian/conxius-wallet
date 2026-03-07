---
title: Device Readiness Report
layout: page
permalink: /docs/device-readiness
---

# Conxius Wallet: Device Readiness Report

**Date:** 2026-02-18  
**Device:** Samsung Galaxy A10 (SM-A105F)  
**OS:** Android 11 (SDK 30)  

## 1. Security Analysis

- **Hardware Keystore:** **TRUSTZONE** (No StrongBox/HSM).
- **Security Patch:** **2023-09-01** (At least one critical vulnerability likely).
- **Biometric Availability:** **Fingerprint** (Good for basic auth).
- **StrongBox Support:** **NOT AVAILABLE** (Falling back to standard TEE-backed AES-GCM).

## 2. Performance Analysis

- **CPU:** Exynos 7884B (8-core 1.6 GHz).
- **RAM:** 2 GB (Extremely tight for full Bitcoin L2/Asset node logic).
- **Storage:** 32 GB (Sufficient for SPV/Electrum-based wallet operation).

## 3. Compatibility Summary

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **TEE Key Storage** | ✅ PASS | Standard Android Keystore (RSA/AES). |
| **StrongBox** | ❌ FAIL | Hardware isolation not present. |
| **BDK Native** | ✅ PASS | Kotlin BDK bindings performing well (300ms sync). |
| **Breez (LN)** | ✅ PASS | Lightning payments functioning with minimal latency. |
| **Biometrics** | ✅ PASS | Fingerprint authentication successful. |
| **Tor Privacy** | ⚠️ MARGINAL | CPU overhead during Tor handshake (~4s). |

## 4. Recommendations

1.  **Fallback Policy:** Ensure the `SecureEnclavePlugin` correctly handles the absence of StrongBox by using standard TEE-backed storage.
2.  **Memory Optimization:** Enable strict memory pruning for the `Persistent Crypto Worker` on devices with <4GB RAM.
3.  **Low-Power Mode:** Automatically disable background indexer sync for high-frequency L2s (like Stacks/Liquid) when battery is <20%.

## 5. Conclusion

The Samsung Galaxy A10 is a **Tier 2** device for Conxius. It is functional for daily Bitcoin and Lightning transactions but may struggle with high-throughput L2 asset management or advanced privacy (CoinJoin).
