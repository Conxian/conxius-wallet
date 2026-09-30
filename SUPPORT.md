# Support for Conxius Wallet & Conxian Platform Ecosystem

This document provides guidance on how to get help across the Conxian platform ecosystem and defines our support tiers, maintainer expectations, and SLA boundaries.

## Ecosystem Tiered Support & SLA Matrix

To maintain sovereign open-source protocol integrity while serving enterprise middleware partners, Conxian enforces a strict **Tiered Support Matrix** separating public protocol code from commercial enterprise integrations.

### Tier 1: Public Core Protocol Repositories (No Commercial SLA)
- **Scope**: `conxius-wallet`, `lib-conxian-core`, `conxius-enclave-sdk`, `conxian-nexus`.
- **Classification**: Open-Source Sovereign Infrastructure & Reference Client.
- **SLA Commitment**: **Explicitly NO Commercial SLA or Financial Guarantees**.
- **Support Model**: Community-best-effort support via GitHub Issues and Discussions under standard open-source license disclaimers (AS-IS without warranty).
- **Maintainer Target Guidelines** (Non-Binding Internal Targets):

| Severity Tier | Definition / Impact | Target Acknowledgment | Target Resolution / Advisory |
| ------------- | ------------------- | --------------------- | ---------------------------- |
| **P0 - Critical** | Exploitable security vulnerability, key loss vector, or unhandled cryptographic failure | < 24 hours | Hotfix / Security Advisory within 48 hours |
| **P1 - High** | Impaired core functionality (e.g., transaction broadcast failure, chain RPC sync block) | < 48 hours | Patch release in < 5 business days |
| **P2 - Normal** | Non-critical bugs, UI/UX polish, or feature requests | < 5 business days | Scheduled in roadmap sprint cycles |

### Tier 2: Enterprise & Gateway Tier (Commercial SLA under B2B Contract Only)
- **Scope**: `conxian-gateway`, ISO 20022 Financial Adapters, and Custom Enterprise Deployments.
- **Classification**: Enterprise Financial Middleware & Portal Gateway.
- **SLA Commitment**: Commercial SLAs are offered **exclusively** under a signed B2B commercial agreement or paid enterprise subscription tier.
- **Scope Boundaries**:
  - **Included**: Integration support, configuration assistance, API route troubleshooting, and business-hours response windows (e.g., Next-Business-Day response).
  - **Explicitly Excluded**: Immutable underlying L1/L2 network availability (Bitcoin, Stacks, Liquid), network congestion, L1 block time variance, force majeure events, and hardware-vendor enclave/StrongBox API deprecations.

---

## End-User Support

If you are an end-user of the Conxius Wallet and need assistance with using the application:

- **Knowledge Base**: Check the [official documentation](https://docs.conxian.io) for guides and FAQs.
- **Community Channels**: Join our [Discord](https://discord.gg/conxian) or [Telegram](https://t.me/conxian) for community-led support.
- **Direct Support**: For account or transaction-related issues, please contact [support@conxian-labs.com](mailto:support@conxian-labs.com).

## Developer & Contributor Support

If you are a developer working with the Conxius Wallet codebase or looking to contribute:

- **Technical Issues**: Open a [GitHub Issue](https://github.com/Conxian/conxius-wallet/issues) using the appropriate template (Bug Report, Feature Request, etc.).
- **Governance & Policy**: For questions regarding project governance or to request policy changes, use the [Governance Request template](.github/ISSUE_TEMPLATE/governance_request.yml).
- **Architecture Discussions**: Participate in [GitHub Discussions](https://github.com/Conxian/conxius-wallet/discussions) for high-level architectural or ecosystem-wide topics.

## Security Vulnerabilities

Do **not** report security vulnerabilities in public issues or community channels.

Please follow the private reporting process documented in [SECURITY.md](SECURITY.md) by emailing [security@conxian.io](mailto:security@conxian.io) or using GitHub's private vulnerability reporting.

## Project Maintenance

This repository is maintained by Conxian Labs. For administrative inquiries, contact [info@conxian-labs.com](mailto:info@conxian-labs.com).
