# Conxian Baseline Review Templates & Governance Pack

**Version:** v1.9.5
**Operational Status:** ACTIVE
**Auditor/Maintainer:** Jules

---

## 🎯 Objective
This document provides a reusable, highly standardized set of tools and templates to implement the **Conxian GitHub Review Baseline** across all Conxian-Labs repositories. It includes a modern reusable issue template pack, a repo-by-repo issue batch, and a single human approval/sign-off prompt.

These assets enforce:
1. **Security Exposure Mitigations** (Zero Secret Egress, credential rotation).
2. **Repository Hygiene** (Git ignore lists, excluding generated artifacts like `node_modules`, `test-results`, `playwright-report`).
3. **Immutable CI Workflows** (Actions pinned to 40-character commit SHAs).
4. **Governance Alignment** (Operating models, CODEOWNERS, license adherence).
5. **Technical Integrity** (Fail-closed guards in both Kotlin native managers and TypeScript BFF layers).

---

## 📦 1. Reusable Issue Template Pack

This pack contains two formats:
1. **GitHub Issue Form (YAML)**: To be placed in `.github/ISSUE_TEMPLATE/conxian_baseline_review.yml` for an interactive user interface on GitHub.
2. **Linear-Compatible Markdown**: Ready to be copied and pasted directly into [Linear](https://linear.app/conxian-labs/team/CON/all).

### A. GitHub Issue Form Schema (`conxian_baseline_review.yml`)
```yaml
name: Conxian Baseline Review
description: Review this repository and complete the next highest-value improvement.
title: "[CON-XXX] Baseline Review: [Repository Name]"
labels: ["Hygiene", "Governance"]
body:
  - type: markdown
    attributes:
      value: |
        ## Objective
        Review this repository and complete the next highest-value improvement using the Conxian GitHub review baseline.
  - type: dropdown
    id: repo_focus
    attributes:
      label: Repo Focus
      description: Choose the targeted repository in the Conxian Ecosystem.
      options:
        - conxius-wallet
        - lib-conxian-core
        - conxian-gateway
        - conxius-platform
        - conxian-nexus
    validations:
      required: true
  - type: checkboxes
    id: baseline_concerns
    attributes:
      label: Baseline Review Concerns & Preconditions
      description: Select any concerns identified during initial scanning.
      options:
        - label: "Public/Private boundary or separation risk"
        - label: "Possible sensitive configuration exposure (e.g., .env)"
        - label: "Tracked runtime/generated artifacts (node_modules, test-results, dist, public/assets)"
        - label: "Inconsistent governance (missing README, LICENSE, SECURITY.md, CODEOWNERS)"
        - label: "Weak release/versioning discipline or version mismatch"
  - type: textarea
    id: selected_task
    attributes:
      label: Selected Task & Priority
      description: Describe the single high-value, self-contained task chosen for remediation.
      placeholder: |
        Priority chosen (1-6): [e.g., Priority 3 - CI Hygiene and Action Pinning]
        Description: [Details of the chosen improvement]
    validations:
      required: true
  - type: textarea
    id: evidence
    attributes:
      label: Evidence Found
      description: List files, lines, or logs proving the existence of the concern.
      placeholder: |
        - File: .github/workflows/ci.yml
        - Line 12: Uses unpinned checkout action.
    validations:
      required: true
  - type: textarea
    id: implementation_details
    attributes:
      label: Implementation & Verification Steps
      description: Outline the changes made and the validation suite used to confirm correctness.
      placeholder: |
        - Changes: [Files edited]
        - Tests: [Tests run, e.g., pnpm run verify]
    validations:
      required: true
```

### B. Linear-Compatible Markdown
```text
## Objective
Review this repository and complete the next highest-value improvement using the Conxian GitHub review baseline.

## Repo focus
[Repository Name]

## Baseline review context
Known cross-org concerns:
- public/private separation risk
- possible sensitive config exposure such as `.env`
- tracked generated/runtime artifacts (`node_modules`, `test-results`, `playwright-report`, `dist`)
- inconsistent governance and repo standards (missing files like `README`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`)
- weak release/versioning discipline
- unclear public-facing purpose/status

## Task for agent
Inspect this repository, research further, and choose exactly one high-value, self-contained task.
Priority:
1. Security exposure or public/private boundary risk
2. Sensitive files or generated artifacts tracked in git
3. Missing ignore rules or CI hygiene (e.g., mutable GitHub Actions refs)
4. Missing governance files
5. README / public-facing clarity improvements
6. Release/versioning improvements

## Deliverables
- Selected task & priority justification
- Evidence found (files/lines)
- Files modified
- Validation results (e.g., test suite logs)
- Documentation updated to sync
- Follow-up items
- Approval note matching operating model

## Constraints
- Do not expose or commit secrets
- Prefer minimal, high-confidence changes
- Improve existing governance/docs rather than duplicating them
```

---

## 📂 2. Repo-by-Repo Issue Batch

Use these pre-configured issue bodies to launch baseline reviews across all core repositories in the Conxian Ecosystem.

### Batch 1: `conxius-wallet` (Mobile Core & Bridged Sovereign)
* **Title:** `[CON-1430] Baseline Review: conxius-wallet`
* **Priority:** High (Mobile Secure Enclave Core)
* **Target Improvements:**
  - Verify zero-secret egress with `AiSecurityService` & ZWC stripping.
  - Audit `.gitignore` for tracked `.keystore` or `android/app/build` directories.
  - Pin pnpm to `11.13.0` across all YAML workflows and check compliance via `check_release_version.mjs`.

### Batch 2: `lib-conxian-core` (Cryptographic Primitives & Wasm compiler)
* **Title:** `[CON-1431] Baseline Review: lib-conxian-core`
* **Priority:** Urgent (Cryptographic Primitives)
* **Target Improvements:**
  - Audit `.gitleaks.toml` rules to scan for BIP-39 seed word fragments in test fixtures.
  - Ensure cargo build targets are ignored (`target/` and `.rs` temporary files).
  - Verify that dual-toolchain output compiles both ES6 and CommonJS targets cleanly without leakage.

### Batch 3: `conxian-gateway` (Institutional Treasury & B2B Web Portal)
* **Title:** `[CON-1432] Baseline Review: conxian-gateway`
* **Priority:** High (Enterprise Interoperability)
* **Target Improvements:**
  - Ensure static web exports exclude `.env.local` or `.next` artifacts.
  - Verify that custom nodes used by enterprise profiles do not bypass `ProductionRuntimeGuard`.
  - Validate FDC3 interoperability filters mapping the `VIEW_INSTRUMENT` intent.

### Batch 4: `conxius-platform` (Multi-tenant Backend & Cloud Infrastructure)
* **Title:** `[CON-1433] Baseline Review: conxius-platform`
* **Priority:** Medium (Backend Controls)
* **Target Improvements:**
  - Audit cloud blueprints for hardcoded access keys or credentials.
  - Standardize logging filters to ensure whitelisted log prefixing is active (e.g., `Guard: `).
  - Pin Action dependencies in `blueprint-validation.yml`.

### Batch 5: `conxian-nexus` (Canonical State Proofs & Mainnet Gateway)
* **Title:** `[CON-1434] Baseline Review: conxian-nexus`
* **Priority:** Urgent (Ecosystem Consensus & Proof Integrity)
* **Target Improvements:**
  - Verify fail-closed guards enforce mainnet gateway alignment when sync state is lost.
  - Ensure that no pre-production simulations are running inside mainnet consensus loops.
  - Document the exact proof segment boundary (364 taps verification) under `docs/consensus/`.

---

## ⚡ 3. Single Approval Workflow Prompt

When Jules completes a baseline review task, the human reviewer (Sizwe Nkosi, COO, or the Lead Security Engineer) must verify the changes before merging.

Use this prompt to instruct an LLM to act as the official **Conxian Gatekeeper** and review Jules' work.

```text
You are the Conxian Gatekeeper, an elite software auditor working directly with COO Sizwe Nkosi and the Lead Security Engineer. Your job is to strictly review the implementation of Jules' Baseline Review output.

Review the following inputs:
1. The baseline review target repository focus.
2. The specific task selected, its priority, and the found evidence.
3. The exact code diff of modified files (paying close attention to security, hygiene, and logic guards).
4. The local verification logs (typescript compilation, unit/integration tests, and security scans).
5. The synchronous updates to ecosystem documentation (PRD, IMPLEMENTATION_REGISTRY, or business state).

Evaluate the submission against the following "Zero-Tolerance Rules":
- RULE 1: Zero Secret Egress. Are there any private keys, seeds, or API tokens committed or logged? (Pass/Fail)
- RULE 2: Immutable Actions. Are all remote GitHub actions pinned to 40-character SHAs? (Pass/Fail)
- RULE 3: Fail-Closed Enclaves. Are critical protocol paths fully fail-closed, rejecting unverified or simulated states in production? (Pass/Fail)
- RULE 4: No Build Artifacts. Are there any tracked node_modules, dist, test-results, or public assets in the diff? (Pass/Fail)
- RULE 5: Document Anti-Drift. Is the documentation in sync with versioning (v1.9.5) and implementation state? (Pass/Fail)

Structure your response as follows:
### 1. Verification Checklist
[List Rule 1 to 5 and indicate Pass/Fail with clear evidence]

### 2. Security & Logic Audit Findings
[Briefly detail why the changes are secure and follow Bridged Sovereign architecture principles]

### 3. Verdict (COO Gate Sign-off)
Choose exactly one:
- "🟢 APPROVED: Aligned with v1.9.5 Operating Model. Ready for promotion to main."
- "🔴 REJECTED: Remediation required. [List clear, actionable fixes]"
```

---
*Created and verified by Jules under v1.9.5 Baseline Review.*
