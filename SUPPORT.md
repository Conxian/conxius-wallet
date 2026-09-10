# Support for Conxius Wallet

This document provides guidance on how to get help with the Conxius Wallet and how to interact with the project team.

## Repository Categorization & Support Expectations

The `conxius-wallet` repository is formally categorized as **Tier 1: Production Core**.

- **Classification**: Production Core (Public Wallet & Reference Client)
- **Scope**: Sovereign mobile wallet application, enclave signing interfaces, and reference client flows.
- **Maintainer SLA Expectations**:

| Severity Tier | Definition / Impact | Target Response SLA | Target Resolution / Mitigation |
| ------------- | ------------------- | ------------------- | ------------------------------ |
| **P0 - Critical** | Exploitable security vulnerability, key loss, or total loss of wallet availability on mainnet | < 24 hours | Hotfix / Security Advisory within 48 hours |
| **P1 - High** | Impaired core functionality (e.g., transaction broadcast failure, chain RPC sync block) | < 48 hours | Resolution in next patch release or < 5 business days |
| **P2 - Normal** | Non-critical bugs, UI/UX polish, or enhancement requests | < 5 business days | Scheduled in roadmap sprint cycles |

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
