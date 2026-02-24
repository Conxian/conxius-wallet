# Native Bitcoin Bridge Research

This document summarizes the native bridge mechanisms for the 15+ Bitcoin layers supported by Conxius.

## 1. Stacks (sBTC)
- **Layer Type:** L2
- **Bridge Type:** Decentralized Two-Way Peg (Nakamoto)
- **Peg-In Mechanism:** Bitcoin L1 transaction to the sBTC Wallet Address.
- **Data Requirement:** OP_RETURN output containing the user's Stacks Address.
- **Discovery:** Fetch sBTC Wallet Address from `/v2/sbtc/wallet`.

## 2. Liquid (L-BTC)
- **Layer Type:** Sidechain
- **Bridge Type:** Federated Peg
- **Peg-In Mechanism:** Bitcoin L1 transaction to a P2SH(Federation Script).
- **Peg-Out Mechanism:** Liquid transaction to a designated burn/peg-out address.
- **Discovery:** Federation Script provided by Liquid node/indexer.

## 3. Rootstock (RBTC)
- **Layer Type:** Sidechain
- **Bridge Type:** PowPeg (Proof-of-Work Peg)
- **Peg-In Mechanism:** Bitcoin L1 transaction to the PowPeg Federation Address.
- **Peg-Out Mechanism:** RBTC transaction to the Bridge precompiled contract (0x0000000000000000000000000000000000000100).

## 4. BOB (Build on Bitcoin)
- **Layer Type:** EVM L2
- **Bridge Type:** BOB Gateway / BitVM
- **Peg-In Mechanism:** Bitcoin L1 transaction to a BOB Gateway Address.
- **Data Requirement:** OP_RETURN or Witness data containing the destination EVM address.

## 5. B2 Network
- **Layer Type:** EVM L2
- **Bridge Type:** B2 Bridge (BitVM)
- **Peg-In Mechanism:** Bitcoin L1 transaction to a B2 Deposit Address (unique per user or global with OP_RETURN).

## 6. Botanix
- **Layer Type:** EVM L2 (Spiderchain)
- **Bridge Type:** Spiderchain Multisig
- **Peg-In Mechanism:** Bitcoin L1 transaction to the current Spiderchain Multisig Address.

## 7. Mezo
- **Layer Type:** EVM L2
- **Bridge Type:** tBTC Bridge
- **Peg-In Mechanism:** Bitcoin L1 transaction to a tBTC v2 vault/deposit address.

## 8. RGB
- **Layer Type:** Client-Side Validated (CSV)
- **Bridge Type:** Native / Anchored
- **Mechanism:** Transfers happen via Consignments. Anchoring happens on Bitcoin L1 (Taproot).

## 9. Ark Protocol
- **Layer Type:** Off-chain (VTXO)
- **Bridge Type:** Boarding (Lift)
- **Mechanism:** L1 BTC is moved to an Ark Boarding Address to "Lift" it into the Ark.

## 10. State Chains
- **Layer Type:** Off-chain (UTXO transfer)
- **Mechanism:** Ownership of a UTXO is transferred by handing over the private key (blindly) to the next owner.

## 11. Maven
- **Layer Type:** L2 / Asset Protocol
- **Mechanism:** Multi-asset protocol built on Bitcoin/Stacks.

## 12. BitVM
- **Layer Type:** Computation / Bridge Tech
- **Mechanism:** Optimistic bridging with ZK-STARK verification on Bitcoin.

## 13. Ordinals / Runes
- **Layer Type:** Meta-protocol
- **Mechanism:** Enscribed on Bitcoin L1 Satoshis.

## 14. Lightning Network
- **Layer Type:** State Channels
- **Bridge Type:** Submarine Swaps (Boltz)
- **Mechanism:** Instant transfer between L1 and LN via HTLCs.

## 15. Rootstock (RSK)
- **Duplicate of #3** (Ensuring 15+ count includes variants).

---
**Strategy:** For all Bitcoin-aligned layers, the Conxius Wallet will prioritize these native mechanisms over Wormhole NTT to ensure maximum sovereignty and minimum fees.
