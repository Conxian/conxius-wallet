---
title: Contributing Guidelines
layout: page
permalink: /contributing
---

# Contributing to Conxius Wallet

Thank you for your interest in contributing to the Conxius Wallet! We welcome
contributions that align with our mission of providing hardware-level security
and sovereign multi-chain management on mobile devices.

## 🛡️ Core Principles

1. **Sovereign by Design**: Prioritize user sovereignty and privacy via the **CXN Guardian** architecture.
2. **Zero Secret Egress**: Never expose private keys or mnemonics in logs or
   network calls.
3. **Local-First**: Utilize on-device TEE (The Conclave) for all cryptographic
   operations.

## 🛠️ Development Standards

### Clarity 4 (Stacks)

All Stacks-related logic must adhere to the **Clarity 4** standard, ensuring
compatibility with the Nakamoto release. This includes:

- Using `Stacks.js` for transaction construction and broadcasting.
- Adhering to post-condition best practices to prevent blind signing.
- Aligning with sBTC peg-in/peg-out state machines.

### Vitest & pnpm

We use **pnpm** (strictly version `11.13.0`) for dependency management and **Vitest** for our test suites.

- All new features MUST include comprehensive unit tests.
- Tests should be located in the `/tests` directory.
- Ensure that all tests pass before submitting a Pull Request: `pnpm test`.

## 🧪 Testing Protocols

Before submitting a change:

1. **Local Hygiene & Security**: Run `pnpm run verify`. This script is the primary gate and performs:
   - Environment version checks (pnpm 11.13.0)
   - Runtime contamination guards (detects simulated/debug leaks in production paths)
   - Unit tests execution (Vitest)
   - Production build verification (TSC + Vite)
2. **Run E2E Tests**: `pnpm run test:e2e` (Playwright)
3. **Verify UI**: Ensure that sensitive fields have `autoComplete="off"` and
   other security attributes.
5. **Check Logs**: Ensure no sensitive data is leaked to the console or Android
   logs.
6. **No Generated Artifacts**: Never commit generated or runtime artifacts
   (e.g., `node_modules`, `dist`, `build`, or Capacitor/Cordova plugins).
   The "Security-First Ignore Policy" is strictly enforced to prevent
   unintentional exposure and ensure build reproducibility.

### Security-First Ignore Policy

To maintain production integrity and prevent secret leakage, the following rules apply to all contributions:
- **Strict `.gitignore` Adherence**: Never use `git add -f` to override ignore rules.
- **Environment Templates**: Only `.env.example` or `.env.template` files are permitted. Actual `.env` files must never be tracked.
- **Artifact Exclusion**: All files in `dist/`, `build/`, `node_modules/`, and generated mobile assets/plugins must be excluded.
- **Credential Hygiene**: Keystores (`.jks`), Private Keys (`.key`, `.pem`), and Service Account JSONs are globally ignored and must remain so.

## 📜 Documentation & PRD Sync

Conxius follows an **Anti-Drift** policy. Any architectural change must be
reflected in the [PRD.md](docs/business/PRD.md) and tracked in [IMPLEMENTATION_REGISTRY.md](docs/protocols/IMPLEMENTATION_REGISTRY.md).

- If you add a new chain or protocol, update the **Layer Unification Matrix**.
- If you modify internal logic, update the corresponding documentation sections
  from **Pending** to **Active**.

## ⚖️ Governance & Approval

Conxius follows a formal operational governance model as defined in [docs/operations/OPERATING_MODEL.md](docs/operations/OPERATING_MODEL.md).

- **COO Sign-off**: All "High" and "Urgent" impact changes require review and explicit sign-off from the COO (**Sizwe Nkosi**) before promotion to `main`.
- **Security Audit**: Changes to native managers or cryptographic primitives require a mandatory security review.
- **Protocol Alignment**: PRs must align with the current **PRD** and **Sovereign State** documentation.

## 🎁 Pull Request Guidelines

- Provide a clear and descriptive title.
- Reference any related issues.
- Adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).
- Complete the governance checklist in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
- Include screenshots or diagrams if the change involves UI or complex logic.
- Ensure your code passes all linting and test checks.

Sovereignty is a journey. Thank you for building it with us. ⚡
