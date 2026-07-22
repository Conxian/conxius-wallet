# Conxius Wallet

![CI](https://github.com/Conxian/conxius-wallet/actions/workflows/ci.yml/badge.svg) ![Security](https://img.shields.io/badge/Security-CXN%20Guardian-orange)

Conxius is a non-custodial, sovereign-first wallet for the Bitcoin ecosystem, combining hardware-isolated security with modern Bitcoin-layer integrations and services.

## Purpose

Provide a non-custodial mobile wallet that unifies Bitcoin-native rails, Stacks, and emerging L2 ecosystems behind hardware-isolated signing and privacy-first defaults.

## Status

**Production (v1.9.5).** This repository is the public wallet and reference client layer for the Conxian ecosystem.

## Scope

This repository contains wallet application code, signer UX, and reference client flows. It does not own canonical protocol logic, shared-core behavior, or infrastructure responsibilities that belong in lower layers of the stack.

## Governance relation

This repository is maintained by Conxian Labs as a public product surface for the Conxian ecosystem. Governance of the underlying protocol is expected to decentralize progressively after mainnet.

## Audience

- end users seeking a sovereignty-first, non-custodial wallet
- mobile and security engineers working on enclave-backed key management
- protocol and integration developers connecting wallet flows to Conxian services

## Relationship to the Conxian stack

- `Conxius Wallet` is the public wallet and reference client.
- `Conxian` is the protocol core.
- `conxian-gateway` provides middleware and integration services.
- `conxian_ui` provides the public web interface layer.
- `lib-conxian-core` houses shared primitives that should live below the client layer.

## Security and privacy model

- Zero Secret Egress via local privacy filtering before AI or network transmission
- Hardware-isolated signing through StrongBox and device-backed secure storage
- Sovereign-first RPC preference for user-controlled infrastructure where supported

## Governance references

- Operating Model: [docs/operations/OPERATING_MODEL.md](docs/operations/OPERATING_MODEL.md)
- Product Requirements: [docs/business/PRD.md](docs/business/PRD.md)
- Sovereign State: [docs/state/Sovereign_State.md](docs/state/Sovereign_State.md)
- SDK Policy: [docs/architecture/SDK_OWNERSHIP_AND_VERSION_POLICY.md](docs/architecture/SDK_OWNERSHIP_AND_VERSION_POLICY.md)
- Control Plane: [docs/architecture/CONTROL_PLANE_MODULES_MAP.md](docs/architecture/CONTROL_PLANE_MODULES_MAP.md)
- Ownership: [CODEOWNERS](CODEOWNERS)

## Release discipline

- Semantic Versioning is enforced.
- Production releases are tagged.
- Every release requires a `CHANGELOG.md` entry.
- Promotion to `main` requires successful validation and approval according to repository policy.
- Release gates and external GitHub settings: [docs/operations/CI_CD_BASELINE.md](docs/operations/CI_CD_BASELINE.md)
- Rollback procedure: [docs/operations/RELEASE_ROLLBACK.md](docs/operations/RELEASE_ROLLBACK.md)

## Prerequisites

- **Node.js**: `22.x` (LTS recommended)
- **Package Manager**: `pnpm` (strictly version `11.13.0`)
- **Android Development**: Android Studio with SDK 36 and Java/JVM 21
- **Capacitor CLI**: For mobile bridge operations

## Development

```bash
# Install dependencies (requires pnpm 11.13.0)
pnpm install

# Run the local hygiene and verification suite (Security + Tests + Build)
pnpm run verify

# Start development server
pnpm run dev

# Run unit tests
pnpm test

# Run E2E tests
pnpm run test:e2e
```

## Security

Do not disclose vulnerabilities publicly. Use [SECURITY.md](SECURITY.md) or `security@conxian.io`.

## Policies

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODEOWNERS](CODEOWNERS)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CHANGELOG.md](CHANGELOG.md)
- [LICENSE](LICENSE)
- [docs/operations/OPERATING_MODEL.md](docs/operations/OPERATING_MODEL.md)
- [docs/business/PRD.md](docs/business/PRD.md)
- [docs/state/Sovereign_State.md](docs/state/Sovereign_State.md)

## Contact

- General: [info@conxian-labs.com](mailto:info@conxian-labs.com)
- Support: [support@conxian-labs.com](mailto:support@conxian-labs.com)
- Security: [security@conxian.io](mailto:security@conxian.io)

## Code of Conduct

All contributors and participants are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT
