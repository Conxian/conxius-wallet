---
title: Recovery Registry
layout: page
permalink: /docs/recovery-registry
---

# Recovery Registry (Quarantined Code)

This document serves as the "Sovereign Quarantine" for the Conxius Wallet. It tracks codebase segments, tests, or features that have been temporarily disabled or moved to /drafts due to security risks, performance regressions, or protocol drifts.

## 🛡️ Anti-Drift Status: [CLEAR]

As of the latest audit, all core protocol implementations (Bitcoin L1, Stacks Clarity 4, Rootstock, Liquid) are aligned with the PRD and passing their respective Vitest 4.0 suites.

## 🧪 Quarantined Tests

The following tests are currently skipped or quarantined. Contributors should check this registry before attempting to reintegrate these segments.

| Test Suite | Reason for Quarantine | Expected Resolution |
| :--- | :--- | :--- |
| `None` | N/A | N/A |

## 📦 Fragmented Logic (Drafts)

The following logic segments are currently held in `/drafts` and are NOT part of the production build:

| Feature | Reason | Status |
| :--- | :--- | :--- |
| `Ark V-UTXO` | Researching Native ASP Client stability. | PENDING |
| `BitVM Verifier` | Waiting for finalized BitVM 2 specs. | RESEARCH |

## 🔄 Reintegration Workflow

1.  **Audit**: Perform a full security audit of the quarantined segment.
2.  **Verify**: Ensure the segment passes all Vitest 4.0 suites.
3.  **Align**: Update documentation in [PRD.md](../PRD.md) to reflect the segment's "Active" status.
4.  **Promote**: Move files from `/drafts` to their respective `/core` or `/services` directories.
5.  **Clear**: Remove the entry from this Registry.
