# Patch Wallet redirect and mocker advisories

Owner: existing org delivery epic Conxian/conxian-business#1390.
Observed on exact documentation candidate 612f75d1ef372ee867534104f78870f4b65fd292:
Dependency Audit reports follow-redirects 1.16.0 and @vitest/mocker 4.1.11.

## Selected change

Upgrade the existing Vitest/UI 4.1 line to 4.1.12 and use the repository's existing
dependency override pattern to pin follow-redirects to 1.16.1. Regenerate the
frozen lockfile with the required pnpm 11.13.0 and preserve Vite 8.3.4, scripts,
workflow files, audit exceptions and all review/release controls.

Patch upgrades minimize compatibility and dependency burden compared with a major
Vitest migration or custom patch. An exception would retain vulnerable code and
does not meet this change's acceptance.

## Primary evidence

- https://github.com/advisories/GHSA-q3jh-wrc6-jgq8
- https://github.com/advisories/GHSA-8r9p-f939-6h3c
- https://github.com/advisories/GHSA-qxg6-89mg-rqv8
- https://github.com/advisories/GHSA-xp26-3454-mjgp

Read 22 October 2026: both redirect advisories identify 1.16.1 as patched;
both mocker advisories identify the compatible 4.1.12 backport.

## Acceptance

Frozen installation and existing dependency audit, unit tests and web build pass
on the final graph. Hosted native/E2E/security checks and genuine required review
remain mandatory. Lockfile resolution and tests do not establish live provider,
hardware, custody, package-provenance or mainnet acceptance. Deliver through the
existing dev -> staged -> main sequence and re-evaluate immutable successors.
