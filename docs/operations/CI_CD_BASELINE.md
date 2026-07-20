# Strict CI/CD Baseline

**Status:** Repository-owned controls implemented for issue #356.

This document separates controls that are enforced by repository files from
settings that must be configured by a GitHub maintainer. The presence of a
workflow or this document does **not** mean the corresponding GitHub setting
has already been configured.

## Required pull-request checks

After the workflows have run once on the default branch, configure branch
protection or a ruleset to require these exact check names for pull requests
targeting `main`:

- `Workflow Pin Verification`
- `Lint`
- `Typecheck`
- `Unit Tests`
- `Web Build`
- `E2E`
- `Dependency Audit`
- `Runtime Contamination Guard`
- `Android Security Policy`
- `Android Lint`
- `Android Unit Tests`
- `Secret Scanning (Gitleaks)`
- `CodeQL (JavaScript and TypeScript)`
- `Dependency Review`

The required-check list must be reviewed whenever a workflow job is renamed.
Do not substitute an artifact upload, a test report, or an optional GitGuardian
job for one of these checks.

## GitHub settings outside the repository

A repository administrator must configure and verify:

1. **Branch rules:** require pull requests, the checks above, conversation
   resolution, and the applicable CODEOWNERS/security review. Disable force
   pushes and branch deletion for `main`; protect release tags according to
   the organization's release policy.
2. **Production environment:** create an environment named exactly
   `production`, require the designated production reviewers, and restrict
   deployment branches/tags to the approved release path. This repository does
   not create or configure that environment.
3. **Release credentials:** provide the Android signing values
   `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, and `KEY_PASSWORD` to
   the verification job, and provide `PLAY_SERVICE_ACCOUNT_JSON` to the
   `production` environment. Keep signing material and service-account JSON
   out of the repository and logs. If the GitHub organization requires a
   Gitleaks organization license for the pinned action, provision the required
   license secret as an external prerequisite; the required scan has no
   conditional secret-presence bypass.
4. **Review ownership:** retain the COO, lead-engineering, and security review
   path required by [OPERATING_MODEL.md](OPERATING_MODEL.md) for high-impact
   release changes. Do not infer reviewer identities from this document.

## Release and public-version reconciliation

The repository-owned expected version is currently `1.9.5`. The release
workflow verifies `package.json`, `metadata.json`, Android `versionName`, the
README production claim, and the top `CHANGELOG.md` entry before building.

After this branch is merged, a maintainer must separately reconcile the public
GitHub release surface: the latest public release was `v1.9.2`, while the
repository claims `1.9.5`. Review the release notes, tag, assets, checksums,
SBOM, and provenance before creating the `v1.9.5` release through the gated
workflow. This implementation does not create or modify a tag or release.

## Repository-owned proof path

- `.github/workflows/ci.yml` exposes independent named checks.
- `.github/workflows/secret-scan.yml` runs Gitleaks without a secret-presence
  conditional; GitGuardian is secondary and optional.
- `.github/workflows/codeql.yml` runs CodeQL for the supported JavaScript and
  TypeScript surface. Kotlin/Java Android sources are intentionally excluded
  from this CodeQL database because their required Gradle/native toolchain is
  already covered by the required Android lint, unit-test, security-policy, and
  release-build gates; adding an unbuildable CodeQL matrix would weaken rather
  than strengthen the proof path.
- `.github/workflows/android-release.yml` builds once, uploads the verified
  payload, attests its checksums, and makes production publication consume that
  downloaded payload under the `production` environment.
- `scripts/ci/validate_android_security.sh` and
  `scripts/ci/check_release_version.mjs` fail closed when required evidence or
  metadata is missing.
