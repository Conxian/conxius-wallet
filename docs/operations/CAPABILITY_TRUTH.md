# Capability and signing truth

Conxius is a local-first, non-custodial universal-chain wallet. Bitcoin L1 is the canonical trust/finality root. Public protocol interfaces belong to conxian.org; managed integration/SLA offerings belong to conxian-labs.com. There is no native Conxian token, tokenomics, or staking incentive. External chains, layers, assets, and independently evidenced protocols remain in scope.

SDK PR #560 records 42 registry identifiers, 52 built-in assets (29 active), 43 protocol modules, 70 capability-evidence rows, and 19 exact Core projections. Those inventories do not prove 70 connected networks or production signing. Qualification must identify the exact build, provider/device, algorithm, chain/network, and operation with current evidence and review.

The current value-operation gate remains authoritative: see `docs/protocols/IMPLEMENTATION_REGISTRY.md`, `docs/state/Sovereign_State.md`, and the CON-1544 KeyMint report. Native selection, an implemented crypto primitive, a StrongBox name, or a final signature alone cannot qualify provider custody, threshold enforcement, broadcast/finality, or recovery. Do not replace fail-closed results with registry fallback. Wallet #727 tracks authenticated operation-manifest integration after the Core contract is reviewed.

The CI artifact contract tests require immutable 40-hex action pins while allowing reviewed upstream updates. Artifact names, ordering, paths, missing-file rejection, release evidence, exact source SHA checks, retry/recovery confirmation, and approved dependency-exception gates remain enforced. Dependabot #702/#704 provide upstream artifact action updates; this change does not auto-approve those changes or dependency exceptions.
