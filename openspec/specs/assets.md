---
title: Assets
layout: page
permalink: /./openspec/specs/assets
---

# Asset Specification (v1.9.2)

## Derivation Paths (Native Enclave Core)
- **Bitcoin L1**: BIP-84 (Native Segwit), BIP-86 (Taproot).
- **Stacks**: m/44'/5757'/0'/0/0.
- **Liquid**: m/84'/1776'/0'/0/0.
- **EVM (BOB/RSK/B2/Mezo/etc.)**: m/44'/60'/0'/0/0.
- **RGB / Taproot Assets**: m/86'/0'/0'/0/0.
- **Ark**: m/84'/0'/0'/1/0.

## Supported Protocols
- **Core**: BTC, LN, sBTC, L-BTC, RBTC.
- **L2 Scaling**: BOB, B2, Botanix, Mezo, Citrea, Alpen, Merlin, Bitlayer.
- **Metaprotocols**: Ordinals, Runes, RGB (Enhanced), Taproot Assets (Enhanced).
- **Staking**: Babylon BTC Staking.

## Validation Requirements
- **RGB**: Full DAG validation via `rgb-lib-wasm`.
- **PSBT**: Strict compliance with BIP-174 and BIP-370.
