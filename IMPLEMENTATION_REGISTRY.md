---
title: Implementation Registry
layout: page
permalink: /registry
---

# Conxius Implementation Registry (Real vs Mocked vs Missing)

This document tracks the ground-truth implementation status of every major feature across the Conxius ecosystem.

## I. CORE INFRASTRUCTURE

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Android Enclave (StrongBox)** | ✅ PRODUCTION | Real TEE/StrongBox key generation, ECDSA & Schnorr signing. |
| **Persistent Crypto Worker** | ✅ PRODUCTION | Singleton worker with session-level secret retention. |
| **ECC Engine Fusion** | ✅ PRODUCTION | Hybrid @noble/curves + tiny-secp256k1. |
| **Zero-Leak Memory** | ✅ PRODUCTION | Strict .fill(0) and try...finally enforcement. |
| **Device Integrity Plugin** | ✅ PRODUCTION | Multi-layer heuristics for root/emulator detection. |

## II. BITCOIN L1 (BTC)

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **BIP-84 (Segwit)** | ✅ PRODUCTION | Full PSBT signing & broadcast. |
| **BIP-86 (Taproot)** | ✅ PRODUCTION | Signing & address derivation implemented. |
| **BIP-352 (Silent Payments)** | ✅ PRODUCTION | Real vault-seed derivation via PIN unlock. |
| **UTXO Manager** | ✅ PRODUCTION | Real-time tracking, dust sweeping, turbo boost. |

## III. BITCOIN LAYERS & SIDECHAINS

| Protocol | Status | Enclave Support |
| :--- | :--- | :--- |
| **Stacks (sBTC)** | ✅ PRODUCTION | Native m/44'/5757' support; real Hiro API. |
| **Liquid (L-BTC)** | ✅ PRODUCTION | Native m/84'/1776' support; liquidjs-lib. |
| **Rootstock (RBTC)** | ✅ PRODUCTION | EVM derivation m/44'/60'; real RPC. |
| **BOB (EVM L2)** | ✅ PRODUCTION-READY SCAFFOLDING | EVM path integrated; fetcher is mock. |
| **Ark Protocol** | ✅ PRODUCTION-READY SCAFFOLDING | VTXO path m/84'/0'/0'/1' integrated. |
| **State Chains** | ✅ PRODUCTION-READY SCAFFOLDING | Seq. path m/84'/0'/0'/2' integrated. |
| **Maven** | ✅ PRODUCTION-READY SCAFFOLDING | Protocol fetcher scaffolded in protocol.ts. |
| **BitVM** | ✅ PRODUCTION-READY SCAFFOLDING | Proof verifier interface scaffolded. |

## IV. ASSET PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Ordinals** | ✅ PRODUCTION | Hiro API integration for balance and metadata. |
| **Runes** | ✅ PRODUCTION | Real-time balance fetch via Hiro Ordinals API. |
| **RGB | 🏗️ IN PROGRESS | Taproot signer path m/86'/0'/0' ready. |
| **BRC-20** | ✅ PRODUCTION | Integrated with Ordinals fetcher. |

## V. INTEROPERABILITY & SWAPS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **NTT Bridge (Wormhole)** | ✅ PRODUCTION | Real Sovereign Transceiver & NTT SDK signing. |
| **Boltz Swaps** | ✅ PRODUCTION | Real submarine and reverse swap execution. |
| **Changelly Swaps** | 🛑 BLOCKED | Logic exists; requires VITE_CHANGELLY_PROXY_URL. |
| **THORChain** | ✅ PRODUCTION | Real memo builder and affiliate tracking. |

## VI. B2B & IDENTITY

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Conxian Gateway** | ✅ PRODUCTION | Full institutional portal integration. |
| **Corporate Profiles** | ✅ PRODUCTION | Encrypted storage & SIWx signing. |
| **Web5 DIDs (did:dht)** | 🔧 PARTIAL | Working but no enclave-backed KeyManager yet. |
| **Sovereignty Meter** | ✅ PRODUCTION | Dynamic scoring based on real security metrics. |

---

## VII. REPAIR & UPGRADE PRIORITY

### 🔴 P0 — Critical Implementation
1. **Ark VTXO Integration**: Move from scaffolding to real balance tracking.
2. **RGB Client-side Validation**: Integrate RGB-lib for real asset management.
3. **BitVM Verifier**: Implement ZK-STARK proof verification.

### 🟠 P1 — Feature Polish
1. **BOB/Maven Fetchers**: Replace mocks with real indexer endpoints.
2. **State Chain Sequential Derivation**: Finalize signing logic for off-chain UTXOs.
3. **Web5 Enclave Bridge**: Connect Web5 KeyManager to the SecureEnclavePlugin.

---

*Last Updated: 2026-02-15*
