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
- `Typecheck` (the job verifies the dual-toolchain manifest and runs both the
  TypeScript 6 and TypeScript 7 compiler paths; this is not a TypeScript
  7-only promotion)
- `Unit Tests`
- `Web Build`
- `E2E`
- `Dependency Audit`
- `Runtime Contamination Guard`
- `Android Security Policy`
- `Android Lint`
- `Android Unit Tests`
- `Secret Scanning (Gitleaks)`
- `CodeQL`
- `Dependency Review`

The required-check list must be reviewed whenever a workflow job is renamed.
Do not substitute an artifact upload, a test report, or an optional GitGuardian
job for one of these checks.

`CodeQL` is the stable aggregate check produced by GitHub-managed default setup.
The language-specific `Analyze (...)` checks are platform-managed and are not
listed separately here.

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
   the verification job, provide the public upload-certificate SHA-256
   fingerprint as the repository variable `ANDROID_SIGNING_CERT_SHA256`, and
   provide `PLAY_SERVICE_ACCOUNT_JSON` to the `production` environment. Keep
   signing material and service-account JSON out of the repository and logs;
   only the public certificate fingerprint is extracted into release metadata.
   The mandatory Gitleaks scan is repository-owned and tokenless; it has no
   commercial-license secret prerequisite. GitGuardian remains an optional
   secondary scan.
4. **CodeQL mode:** use exactly one CodeQL mode per repository. This repository
   uses GitHub-managed default setup, so do not enable a repository-owned
   advanced CodeQL workflow or configuration alongside it. Keep the aggregate
   `CodeQL` check enabled.
5. **Review ownership:** retain the COO, lead-engineering, and security review
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
- `.github/workflows/secret-scan.yml` installs the official Gitleaks Linux x64
  CLI under the runner temporary directory, verifies its pinned checksum, and
  scans full repository history with redacted output and the narrow repository
  configuration; GitGuardian is secondary and optional.
- GitHub-managed CodeQL default setup provides the stable aggregate `CodeQL`
  check and its platform-managed language `Analyze (...)` checks. Exactly one
  CodeQL mode is permitted; no repository-owned advanced workflow/configuration
  is tracked here.
- `.github/workflows/android-release.yml` builds once, extracts and verifies
  APK/AAB package identity, version, versionCode, and public signing
  certificate identity, uploads the verified payload, attests each checksum
  subject, and makes production publication verify every downloaded attestation
  before consuming that payload under the `production` environment.
- `scripts/ci/validate_android_security.sh` and
  `scripts/ci/check_release_version.mjs` fail closed when required evidence or
  metadata is missing.
