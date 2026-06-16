# Conxius Wallet

![CI](https://github.com/Conxian/conxius-wallet/actions/workflows/ci.yml/badge.svg) ![Security](https://img.shields.io/badge/Security-CXN%20Guardian-orange)

Conxius is a non-custodial, sovereign-first wallet and reference client for the broader Conxian ecosystem.

## Purpose

Provide a non-custodial wallet that unifies Bitcoin-native rails, Stacks, and emerging L2 ecosystems behind hardware-isolated signing and privacy-first defaults.

## Status

**Production (v1.9.2).** This repository is the public wallet and reference client layer for the Conxian ecosystem.

## Scope

This repository contains wallet application code, signer UX, and reference client flows. It is a sovereign access and signing boundary. It does not own canonical protocol logic, protocol governance, or Labs operating authority.

## Governance relation

This repository is maintained by Conxian-Labs as a public product and access surface around Conxian. Governance of the underlying protocol remains separate from the wallet layer.

## Audience

- end users seeking a sovereignty-first, non-custodial wallet
- mobile and security engineers working on enclave-backed key management
- protocol and integration developers connecting wallet flows to Conxian services

## Relationship to the Conxian stack

- `Conxius Wallet` is the public wallet and reference client.
- `Conxian` is the protocol and DAO-facing core.
- `conxian-gateway` provides middleware and integration services.
- `conxian_ui` provides the public interaction layer.
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

## Development

```bash
pnpm install
pnpm run dev
pnpm test
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
