---
title: Contributing Guidelines
layout: page
permalink: /contributing
---

# Contributing to Conxius Wallet

Thank you for your interest in contributing to the Conxius Wallet! We welcome contributions that align with our mission of providing hardware-level security and sovereign multi-chain management on mobile devices.

## 🛡️ Core Principles

1.  **Sovereign by Design**: Prioritize user privacy and self-custody.
2.  **Zero Secret Egress**: Never expose private keys or mnemonics in logs or network calls.
3.  **Local-First**: Utilize on-device TEE (The Conclave) for all cryptographic operations.

## 🛠️ Development Standards

### Clarity 4 (Stacks)
All Stacks-related logic must adhere to the **Clarity 4** standard, ensuring compatibility with the Nakamoto release. This includes:
-   Using `Stacks.js` for transaction construction and broadcasting.
-   Adhering to post-condition best practices to prevent blind signing.
-   Aligning with sBTC peg-in/peg-out state machines.

### Vitest 4.0
We use **Vitest 4.0** for our frontend and logic test suites.
-   All new features MUST include comprehensive unit tests.
-   Tests should be located in the `/tests` directory.
-   Ensure that all tests pass before submitting a Pull Request: `npm test`.

## 🧪 Testing Protocols

Before submitting a change:
1.  **Run All Tests**: `npm test`
2.  **Verify UI**: Ensure that sensitive fields have `autoComplete="off"` and other security attributes.
3.  **Check Logs**: Ensure no sensitive data is leaked to the console or Android logs.

## 📜 Documentation & PRD Sync

Conxius follows an **Anti-Drift** policy. Any architectural change must be reflected in the [PRD.md](PRD.md).
-   If you add a new chain or protocol, update the **Layer Unification Matrix**.
-   If you modify internal logic, update the corresponding documentation sections from **Pending** to **Active**.

## 🎁 Pull Request Guidelines

-   Provide a clear and descriptive title.
-   Reference any related issues.
-   Include screenshots or diagrams if the change involves UI or complex logic.
-   Ensure your code passes all linting and test checks.

Sovereignty is a journey. Thank you for building it with us. ⚡
