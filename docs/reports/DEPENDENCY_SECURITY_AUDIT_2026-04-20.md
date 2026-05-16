# Dependency Security Audit & Dependabot Review (2026-04-20)

## 1. Executive Summary
A comprehensive audit of the Conxius Wallet and lib-conxian-core dependencies was conducted to ensure alignment with production readiness standards (v1.9.2). Key focus areas included transitively vulnerable NPM packages, outdated Rust crates, and Dependabot coverage.

## 2. Dependabot Enhancements
- **Added Cargo Ecosystem**: The `.github/dependabot.yml` has been updated to track Rust dependencies in `/lib-conxian-core` weekly.
- **Current Coverage**: NPM (Daily), Gradle (Weekly), GitHub Actions (Weekly), Cargo (Weekly).

## 3. Vulnerability Findings

### 3.1. NPM (Total: 15)
The following high-risk transitive vulnerabilities were identified:
- **protobufjs (Moderate/High)**: Prototype pollution and UTF-8 decoding issues via `@wormhole-foundation/sdk`.
- **lodash (Moderate)**: Prototype pollution via `@web5/api`.
- **ajv (Moderate)**: ReDoS vulnerability via `@web5/api`.
- **uuid (Moderate)**: Buffer bounds check issue via `@solana/web3.js`.
- **elliptic (Low)**: Risky implementation of cryptographic primitives.

**Recommendation**: Update top-level SDKs (`@web5/api`, `@wormhole-foundation/sdk`) to their latest patches. If updates are blocked by breaking changes, use `pnpm.overrides` to force patched versions of transitive dependencies.

### 3.2. Rust (lib-conxian-core)
Manual review of `Cargo.lock` identified potential risks in:
- **h2 (0.3.27)**: Outdated HTTP/2 implementation.
- **rustls (0.21.12)**: Should be updated to the 0.23.x lane for enhanced memory safety.
- **cookie (0.16.2)**: Transitive dependency with potential security implications.

**Recommendation**: Run `cargo update` to pull latest security patches for non-breaking crates.

### 3.3. Android (Gradle)
- **sqlcipher (4.5.4)**: Recommended update to **4.6.1+** to address known SQLite vulnerabilities.
- **bdk-android (2.3.1)**: Version is stable; monitor for security advisories related to descriptor management.

## 4. Next Steps
1. **Manual Remediation**: Protocol leads should review the identified SDK updates to ensure no regressions in signature flows or bridge logic.
2. **Automated Monitoring**: Monitor the new Cargo Dependabot alerts for immediate RUSTSEC patches.
