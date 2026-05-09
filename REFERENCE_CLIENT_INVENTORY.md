# Reference client cleanup inventory

## Purpose

This inventory identifies the main overlap signals that should be reduced so `conxius-wallet` remains a clear reference client rather than an embedded lower-layer workspace.

## Classification labels

- **narrow**: keep but reduce ownership scope
- **replace**: move to cleaner package/API consumption path
- **move**: better home exists outside the wallet repo
- **keep**: reference-client concern that should remain

## Current inventory

### Embedded strategic repo references

- `.gitmodules` -> **replace**
- `conxian-gateway/README.md` -> **replace**
- visible `lib-conxian-core` root reference -> **replace**
- `openspec/specs/submodules.md` -> **narrow**

Reason:
- embedded lower-layer strategic repos make the wallet act like a hidden integration workspace instead of a reference client

### Role guidance already established

- `REPO_OWNERSHIP.md` -> **keep**

Reason:
- reinforces the reference-client role and should remain

### Broader architecture and operations docs

- `docs/architecture/GCP_INFRASTRUCTURE.md` -> **narrow**
- `docs/operations/SYSTEM_ALIGNMENT_ENHANCEMENT_PLAN.md` -> **move or narrow**
- `docs/operations/VERIFICATION_PATHWAY.md` -> **narrow**

Reason:
- these may contain useful material, but they should be reviewed so the wallet does not carry broad infrastructure or system-alignment ownership beyond what is needed for a reference client

## Working rule

During cleanup:
- keep wallet UX and reference-client behavior here
- replace embedded lower-layer ownership with cleaner dependency or API consumption paths
- move broader platform/infrastructure ownership outward when it is not required to understand or run the reference client

## Suggested PR sequence

### PR 1

- inventory and document submodule and embedded dependency replacement targets

### PR 2

- reduce embedded lower-layer references where low-risk

### PR 3

- narrow or move broader architecture/operations docs

### PR 4

- clean remaining overlap and reinforce reference-client framing in docs

## Target outcome

After cleanup:
- the wallet remains a strong reference client
- lower-layer ownership is visibly outside the repo
- docs and structure reinforce a reference-client role instead of a hidden integration monorepo pattern
