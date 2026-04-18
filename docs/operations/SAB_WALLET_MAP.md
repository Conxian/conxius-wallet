# SAB-Owned Wallet Destinations & Handoff Sequence (CON-482)

This document defines the canonical wallet and treasury destination map for the Conxian ecosystem, ensuring a transition from bootstrap operators to DAO-aligned control.

## 1. Wallet Destination Map

| Role | Principal (Mainnet) | Status | Owner |
| :--- | :--- | :--- | :--- |
| **Bootstrap / Execution** | `SPSZXAKV7DWTDZN2601WR31BM51BD3YTQWE97VRM` | Active | Operator (Sizwe Nkosi) |
| **Protocol Treasury** | `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE` | Active | SAB (Enclave) |
| **Reserve System** | `SP1...RESERVE` | Pending | DAO (Multi-sig) |
| **Labs Operations** | `SP2...LABS` | Pending | Conxian Labs |
| **Contributor Claims** | `SP3...CLAIMS` | Pending | DAO (Automation) |
| **Founder Vault** | `SP4...FOUNDER` | Pending | Founder (Locked) |

## 2. Handoff Sequence

1. **Initial Bootstrap**: Execution handled via the operator principal (`SPSZXAKV7DWTDZN2601WR31BM51BD3YTQWE97VRM`).
2. **SAB Transition**: All protocol-critical logic (fees, rewards) routes to the SAB-controlled Treasury principal (`SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE`).
3. **DAO Activation**: Transition of Treasury and Reserve control to a 3-of-5 Multi-sig (DAO) comprising core stakeholders and independent auditors.

## 3. Security Controls

- **Enclave Signing**: All SAB-owned transactions MUST be initiated within the Conclave TEE.
- **Time-locks**: A 144-block time-lock is enforced for all treasury-outbound transfers exceeding 1000 STX equivalent.
- **Audit Logging**: All execution attempts are logged to the Sovereign State MMR.

---
*Updated: April 18, 2026*
