# Conxius Operating Model (v1.0)

## Overview
This document defines the operational governance and decision-making framework for Conxius Wallet and Conxian Gateway, ensuring alignment across technical delivery, security audit, and business oversight.

## Stakeholders & Approval Path

### 1. Executive Committee (ExCo)
- **Founder**: Primary anchor for strategic direction and protocol-level decisions.
- **COO (Sizwe Nkosi)**: Responsible for interim review, operational approval, and launch-gate sign-off.
  - *Interim Approval Path*: COO review is required for all "High" and "Urgent" issues before final promotion from `staged` to `main`.
  - *Communication*: Review outcomes are recorded in Linear comments.

### 2. Engineering & Security
- **Lead Engineer**: Accountable for technical implementation and "Fast Track" verification.
- **Security Lead**: Accountable for CXN Guardian audits and PII/Secret egress prevention.

## Launch Gate (CON-129)
The final GO/NO-GO decision for mainnet deployment requires unanimous sign-off from:
1. **Founder** (Strategic Alignment)
2. **COO** (Operational Readiness)
3. **Lead Engineer** (Technical Integrity)
4. **Security Lead** (Audit Compliance)

## Repository Promotion Pipeline
1. **`dev`**: Active development and testnet validation.
2. **`staged`**: Mainnet candidate validation and "Security Audit" lane.
3. **`main`**: Production-only. Promotion requires "COO Approval" and successful "E2E Validation".

---
*Updated: April 16, 2026*
