# RISK_REGISTRY.md

## Bitcoin Layer Risk Assessment

This document outlines the risk profiles of the Bitcoin L2s and Sidechains supported by the Conxius Wallet. The assessments are based on publicly available information and are intended to provide users with a clear understanding of the trust assumptions involved with each layer.

---

### Stacks (sBTC)

*   **Risk Warning:** **Decentralized, but Novel.**
*   **Custody Model:** The sBTC peg is designed to be trust-minimized and decentralized. However, the system's security relies on a novel consensus mechanism (Proof-of-Transfer) and the economic incentives of STX miners.
*   **Key Consideration:** While not custodial in the traditional sense, users should be aware that the security of their assets is tied to the Stacks network's consensus and the correct functioning of the sBTC protocol.

---

### Rootstock (RSK)

*   **Risk Warning:** **Federated.**
*   **Custody Model:** Rootstock uses a merge-mined model, which provides a high degree of security. However, the two-way peg (PowPeg) is managed by a federation of well-known blockchain companies.
*   **Key Consideration:** Users are trusting this federation to act honestly and competently in managing the peg. While the federation is composed of reputable members, this is a form of federated custody.

---

### Liquid Network (L-BTC)

*   **Risk Warning:** **Federated.**
*   **Custody Model:** The Liquid Network is a sidechain with a federated model. A group of "functionaries" (trusted parties) are responsible for managing the two-way peg.
*   **Key Consideration:** This is a custodial model where users are trusting the federation of functionaries to secure their assets. The security of the network is dependent on the integrity of these functionaries.
