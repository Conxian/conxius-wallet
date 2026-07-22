# TypeScript Dual Toolchain

**Scope:** Issue [#396](https://github.com/Conxian/conxius-wallet/issues/396)
**Status:** Dual-validation implementation; not a TypeScript 7-only/default promotion.

## Why two TypeScript lanes exist

The repository currently uses TypeScript `7.0.2` for the compiler CLI, but the
installed `typescript-eslint` `8.65.0` line requires the TypeScript programmatic
API range `>=4.8.4 <6.1.0`. TypeScript 7 therefore cannot be the API consumed by
ESLint/parser tooling yet. The repository keeps both lanes explicit instead of
weakening lint rules or suppressing the peer-compatibility warning.

| Surface | Command/package | Role |
| --- | --- | --- |
| TypeScript 7 CLI | `tsc`, provided by `@typescript/native` (`npm:typescript@7.0.2`) | Current forward-compatibility compiler and web-build typecheck. |
| TypeScript 6 CLI | `tsc6`, provided by `typescript` (`npm:@typescript/typescript6@6.0.2`) | Compatibility compiler for the supported lint/parser API lane. |
| Programmatic API | `import 'typescript'` | TypeScript 6.x API used by `typescript-eslint` and other API consumers. |

The aliases are exact in `package.json` and locked in `pnpm-lock.yaml`. The
frozen lockfile pins the bridge's transitive TypeScript 6 compiler/API patch,
currently `6.0.3`, even though `@typescript/typescript6@6.0.2` resolves it via
a TypeScript 6 range. The verifier intentionally enforces supported major `6`
rather than an exact patch unless project policy requires that tightening. Do
not replace the aliases with broad ranges or rely on a globally installed
compiler.

## Local and CI commands

Use the repository's pinned pnpm through Corepack:

```bash
corepack pnpm install --frozen-lockfile
pnpm run check:typescript-toolchain
pnpm run typecheck:ts6
pnpm run typecheck:ts7
pnpm run typecheck:dual
pnpm run lint
pnpm run build
pnpm run verify
```

`check:typescript-toolchain` is a deterministic smoke verifier. It checks the
manifest aliases, boundary config/script presence, local `tsc` and `tsc6` major
versions, package metadata, and the imported TypeScript API. It resolves local
`node_modules/.bin` entries and the workspace package, so it does not depend on
a global installation.

The required CI `Typecheck` job runs the smoke verifier, TypeScript 6
typecheck, and TypeScript 7 typecheck after `pnpm install --frozen-lockfile`.
The lint job remains a separate required gate. The production `build` command
uses the TypeScript 7 boundary before Vite; the dual typecheck job prevents the
compatibility lane from drifting while avoiding a second full compiler pass in
every build job.

## Configuration boundaries

- `tsconfig.json` remains the shared source of compiler options.
- `tsconfig.ts6.json` is the explicit TypeScript 6 compatibility entry point.
- `tsconfig.ts7.json` is the explicit TypeScript 7 forward-compatibility entry
  point.
- `typecheck:dual` is the combined developer command; CI keeps each compiler
  step named so failures identify the lane that broke.

Vite and its plugins continue to use the existing Vite configuration. Vite's
production build is validated with the TypeScript 7 CLI, while the lockfile and
smoke verifier ensure that package-peer resolution still supplies TypeScript 6
to programmatic consumers. No Vite plugin or bundler configuration should
silently import a second unpinned TypeScript copy.

## Lint, parser, and editor policy

`eslint.config.js` and its rules are unchanged. `typescript-eslint` resolves
the workspace `typescript` package, which is intentionally the TypeScript 6
API alias. Do not silence the unsupported-version warning, widen parser peer
ranges locally, or weaken lint rules to make TypeScript 7 appear compatible.

Editors should use the workspace TypeScript package for the lint/parser
compatibility path. A developer may experiment with a TypeScript 7 language
service separately, but the editor default must not be changed to TypeScript 7
until the parser/plugins and language-service integrations are verified and
COO approval is recorded. The repository's explicit CLI commands are the
source of truth for CI and release evidence.

## Native, FFI, Android, and E2E validation surfaces

This change is JavaScript toolchain configuration only. It does not alter
native signing, Kotlin managers, Rust, JNI, or FFI code. TypeScript typechecks
therefore do not replace:

- targeted native bridge/signing regression tests;
- Rust formatting, locked dependency checks, and Rust tests;
- JNI/cargo-ndk contract checks;
- Android Gradle lint, unit tests, SDK/NDK compilation, or release packaging;
- Playwright browser installation and browser E2E tests.

Where the local environment lacks an Android SDK/NDK or Playwright browser,
record the blocker and leave those gates to the hosted CI jobs. Existing unit,
build, E2E, native, JNI, and Android workflow gates must remain intact when
editing TypeScript validation.

## Rollback and promotion policy

If the dual-toolchain path is not accepted, roll back to the manifest and lock
state from PR [#404](https://github.com/Conxian/conxius-wallet/pull/404), the
TypeScript `6.0.3` bridge, and its associated commands. Regenerate the lockfile
with the pinned pnpm version rather than hand-editing dependency entries.

This branch proves that both compiler lanes can be validated together. It does
**not** prove sole-toolchain TypeScript 7 completion, authorize making TypeScript
7 the default programmatic API, or authorize promotion to `main`. Any
TypeScript 7-only/default promotion requires explicit COO approval under the
repository operating model.
