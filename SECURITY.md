---
title: Security
layout: page
permalink: /./SECURITY
---

# Security Policy

## Supported Versions

We currently provide security updates for the following versions:

| Version | Supported |
| ------- | --------- |
| 1.9.x | ✅ |
| < 1.9.2 | ❌ |

## Reporting a Vulnerability

We take the security of Conxius Wallet seriously.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately using one of these channels:

1. GitHub private vulnerability reporting for this repository.
2. Email [security@conxian-labs.com](mailto:security@conxian-labs.com).

Please include:

- a description of the vulnerability
- steps to reproduce the issue
- potential impact
- any suggested fixes

We aim to acknowledge reports within 48 hours and will coordinate remediation responsibly.

## Secret handling

- do not commit `.env*` files, private keys, keystores, or API tokens
- use `.env.example`, `.env.template`, or equivalent non-secret templates only
- rotate any exposed credentials immediately
- pull requests and key branches are scanned with `gitleaks` in GitHub Actions
