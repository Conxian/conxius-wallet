# TypeScript 6/7 Dual Toolchain

**Decision:** Keep TypeScript 7 available for compiler and build validation while
keeping the TypeScript 6 API available to `typescript-eslint` until its supported
range includes TypeScript 7.

**Scope:** JavaScript tooling only. This change does not alter Kotlin, Rust, JNI,
Capacitor, or native signing code. COO approval is required before this change is
merged or promoted to `main`.

## Version and ownership boundary

The aliases are intentionally exact and are enforced by
[`scripts/ci/check_typescript_toolchain.mjs`](../../scripts/ci/check_typescript_toolchain.mjs):

| Role | Package manifest alias | Command | Reported compiler |
| --- | --- | --- | --- |
| TypeScript 7 compiler/build lane | `@typescript/native: npm:typescript@7.0.2` | `tsc`, `pnpm run typecheck:ts7` | `7.0.2` |
| TypeScript 6 parser/API lane | `typescript: npm:@typescript/typescript6@6.0.2` | `tsc6`, `pnpm run typecheck:ts6` | `6.0.3` |

The TypeScript 6 package version is `6.0.2`, but its compiler reports `6.0.3`.
That package-version/report-version distinction is expected and is part of the
guard contract. The TypeScript 7 package and compiler both report `7.0.2`.

- `tsc` and the default `typecheck`/build path are owned by TypeScript 7.
- `tsc6` is an explicit compatibility lane and must not be silently substituted
  for the build compiler.
- ESLint continues to use `typescript-eslint` without rule weakening. Because
  the package named `typescript` resolves to the TypeScript 6 alias, the
  `typescript-eslint@8.65.0` parser/API consumer receives the supported TypeScript
  6 API while application typechecking still exercises TypeScript 7.
- `pnpm run check:typescript-toolchain` verifies aliases, lockfile importer and
  package records, reported compiler versions, and script ownership. A direct
  TypeScript 7 dependency under the package name `typescript` fails closed.
- The existing `check:typescript-compat` command remains as a backward-compatible
  entry point for callers of the restored TypeScript 6 bridge; it delegates to
  the same authoritative dual-toolchain guard rather than maintaining a second
  version policy.

## Editor and language-service behavior

No `typescript.tsdk` or other editor path is hard-coded in this change. Editors
that honor the workspace TypeScript package will see the TypeScript 6 API alias,
which is the safe default for the current lint/parser ecosystem. TypeScript 7
editor validation remains an editor-specific manual gate: use the editor's
workspace/bundled version selector or an explicitly supported TypeScript 7
installation, then record the editor version and selected compiler in the review
evidence. Do not commit an unstable `node_modules/@typescript/native` editor path
until the supported editor behavior is demonstrated across the repository's
development environments.

The command-line lanes are authoritative when editor selection is unavailable:
`pnpm run typecheck:ts6` validates the compatibility API and
`pnpm run typecheck:ts7` validates the application compiler.

## Vite and plugin behavior

Vite owns runtime transforms and does not become the TypeScript 6 compatibility
lane. The repository build runs `pnpm run typecheck:ts7` before `vite build`, so
Vite/plugin behavior is validated against the TypeScript 7-checked source without
changing ESLint's TypeScript API. A successful production build and Playwright
run are still required evidence for Vite, React, WASM, and top-level-await plugin
behavior; compiler success alone is not a substitute.

## Native and FFI impact

The aliases do not change the Kotlin/Rust/JNI ABI or the fail-closed native
signing boundary. They can still expose declaration or bridge-contract issues
when TypeScript 7 checks Capacitor/native request and response types. Required
follow-up evidence is therefore:

1. Focused native bridge, signer-boundary, and public-only payload tests.
2. Rust formatting, locked dependency checks, and native tests.
3. Capacitor sync followed by hosted Android lint and unit tests.
4. Device/emulator and signed release validation in the authorized hosted
   environment; local success without an SDK, NDK, signing material, or device
   does not close those gates.

No private keys, mnemonics, signing material, or native secrets belong in the
toolchain guard, fixtures, logs, or documentation.

## Promotion and rollback policy

TypeScript 7 is a deliberate validation lane, not a routine dependency
promotion. Dependabot excludes TypeScript 7-or-later updates for both the
`typescript` alias and `@typescript/native`; direct or wildcard edits remain
subject to the repository guard, review, and COO approval. The lockfile must be
regenerated and frozen-install evidence recorded for any intentional version
change.

**Exact compatibility rollback route:**

```bash
# After a merged change, replace <merge-commit> with the PR merge commit.
git revert -m 1 <merge-commit> --no-edit

# If the rollback must return to the last known TypeScript 6 root state rather
# than the pre-bridge TypeScript 7 state, restore the package/lock pair from the
# TypeScript 6 bridge commit and commit that explicit rollback.
git restore --source=a4bfb7d09b8008267c4fc2f7a907cdddfc6007dc -- package.json pnpm-lock.yaml
CI=true pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run lint
```

The explicit rollback target is PR #404's verified TypeScript 6 bridge commit
(`a4bfb7d09b8008267c4fc2f7a907cdddfc6007dc`). If the dual-toolchain files are
still present after a partial rollback, remove them with the same revert rather
than leaving an unguarded mixed state. Re-run the full verification pathway
before any promotion.

## Evidence and governance

The durable implementation evidence is split between this decision record, the
guard tests in `tests/ci/typescript-toolchain.test.mjs`, and the explicit CI
lanes in `.github/workflows/ci.yml` and `.github/workflows/android-release.yml`.
Local compiler, lint, test, build, Playwright, Rust, and Android outcomes must be
recorded in the pull request. Hosted/device gates and COO approval remain
external gates when they cannot be verified in the current environment.
