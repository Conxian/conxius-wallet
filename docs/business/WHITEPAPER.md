---
title: Technical Whitepaper
layout: page
permalink: /whitepaper
---

# Conxius Wallet: The Full Bitcoin Ecosystem Technical Whitepaper

## Abstract

Conxius is the definitive sovereign interface for the entire Bitcoin ecosystem. It bridges the gap between Bitcoin L1 and the burgeoning landscape of Layer 2s, sidechains, and asset protocols. By utilizing an Android-native Secure Enclave model, Conxius provides hardware-level security for BTC, Lightning, Liquid, Stacks, RSK, BOB, RGB, Ordinals, Runes, Ark, BitVM, and State Chains—all within a single, unified mobile application.

## 1. The Full Ecosystem Vision

Bitcoin is no longer just a store of value; it is a multi-layered programmable ecosystem. Conxius is designed to be the central hub for this "New Bitcoin City," providing:
- **Security Sovereignty**: Keys are generated and protected by hardware-backed TEE and StrongBox.
- **Protocol Sovereignty**: Native support for every major Bitcoin-adjacent protocol.
- **Execution Sovereignty**: On-device signing and verification, minimizing reliance on centralized intermediaries.

## 2. Cryptographic Architecture

### 2.1. Unified Multi-Path Derivation

Conxius implements a sophisticated BIP-32 derivation strategy to support the diverse needs of the ecosystem:
- **m/84'/0'/0'**: Native Segwit (L1, Liquid, Ark)
- **m/86'/0'/0'**: Taproot (L1, RGB, Ordinals)
- **m/44'/60'/0'**: EVM Compatibility (BOB, RSK, ETH)
- **m/44'/5757'/0'**: Stacks Ecosystem
- **m/84'/0'/0'/1'**: Ark VTXO Management
- **m/84'/0'/0'/2'**: State Chain Sequential Keys

### 2.2. Enclave-First Signing

The **Signing Enclave** (Native Java/Kotlin) is the heart of Conxius. It handles:
- **ECDSA (secp256k1)**: For legacy and Segwit layers.
- **Schnorr (Taproot)**: For RGB and Ordinals (optimized via ECC Engine Fusion).
- **Recoverable Signatures**: For EVM and Stacks compatibility.

## 3. Layer-Specific Implementations

### 3.1. Lightning (Breez SDK)
Conxius integrates the Breez SDK via a native JNI bridge, providing non-custodial Lightning payments, LNURL support, and on-chain/off-chain swaps within the enclave boundary.

### 3.2. Liquid & Stacks (Native Pegs)
We prioritize native 1:1 pegs over wrapped assets.
- **Liquid**: Native P2WPKH and confidential address support with federation peg-in monitoring.
- **Stacks (sBTC)**: Integration with Nakamoto's threshold signature scheme for trustless BTC movement to Stacks.

### 3.3. BOB & RSK (EVM L2s)
Conxius treats Bitcoin-backed EVM layers as first-class citizens, using standard EVM derivation paths while anchoring security in the Bitcoin-originated seed.

### 3.4. RGB & Asset Protocols
- **RGB**: Implements client-side validation logic and Taproot-based seals for private, scalable smart contracts.
- **Ordinals/Runes**: Native inscription management and balance tracking integrated into the core UTXO manager.

### 3.5. Ark & State Chains
- **Ark**: Support for shared UTXOs (VTXOs) via the Ark protocol, enabling instant payments without the liquidity constraints of Lightning.
- **State Chains**: Sequential derivation for off-chain UTXO transfers, providing high-throughput, low-cost Bitcoin mobility.

## 4. Security Hardening

### 4.1. Android TEE & StrongBox
Conxius leverages the highest available security level on Android. On supported devices (e.g., Google Pixel), keys are generated within the **StrongBox Keymaster**, a dedicated security chip.

### 4.2. Zero-Leak Memory Management
The "Zero-Leak" policy ensures that:
- Sensitive buffers (seeds, private keys) are zero-filled immediately after use.
- The UI layer never touches plaintext secret material.
- Secure session keys are used for application state, expiring automatically upon lock.

### 4.3. Device Integrity Heuristics
A multi-layered integrity check (`DeviceIntegrityPlugin`) monitors for root/jailbreak, emulator environments, and dangerous system properties to protect the enclave from OS-level compromises.

## 5. The Conxian Gateway (B2B)

The **Conxian Gateway** extends the wallet's capabilities to the enterprise:
- **Corporate Treasury**: Managed via multi-sig quorums signed on Conxius.
- **Institutional Launchpad**: Tools for issuing and managing assets on Bitcoin L2s.
- **Shielded Payments**: Privacy-centric corporate settlement layers.

## 6. Conclusion

Conxius is more than a wallet; it is a sovereign operating system for the Bitcoin ecosystem. By combining hardware-grade security with an expansive protocol matrix, we provide the foundation for the next generation of Bitcoin finance.
