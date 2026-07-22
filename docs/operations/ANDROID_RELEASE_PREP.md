---
title: Android Release Preparation Guide
layout: page
permalink: /docs/android-release-prep
---

# Android Release Preparation Guide

**Last Updated:** 2026-07-22
**Status:** Pre-release checklist — all items must be completed before Play Store submission.

For the current release-baseline debt inventory and evidence requirements, see
the [Technical Debt Register](TECHNICAL_DEBT_REGISTER.md).

---

## 1. Google Cloud Project Setup

### 1.1 Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: `conxius-wallet` (or similar)
3. Enable billing (required for Play Integrity API)

### 1.2 Enable Required APIs

- **Play Integrity API** — Used by the client-side `PlayIntegrityPlugin.kt`; backend verification is still required before enforcement. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).
- **Firebase Cloud Messaging** — If push notifications are needed
- **Google Play Developer API** — For automated publishing

### 1.3 Service Account

1. Create a service account: `conxius-ci@<project>.iam.gserviceaccount.com`
2. Grant role: `Service Account User`
3. Download JSON key → store in CI secrets (never in repo)

---

## 2. Google Play Console Setup

### 2.1 Developer Account

1. Go to [Play Console](https://play.google.com/console)
2. Register as developer ($25 one-time fee)
3. Organization: `Conxian Labs`

### 2.2 App Listing

1. Create app: `Conxius Wallet`
2. Category: Finance → Cryptocurrency
3. Content rating: Complete questionnaire (no violence, no gambling)
4. Privacy policy URL: Required — host at `https://conxius.com/privacy`
5. Data safety: Complete the form from the actual release build and telemetry policy; do not make a blanket no-data-collection claim while Play Integrity or rollout telemetry is enabled

### 2.3 App Signing

1. **Use Play App Signing** (recommended by Google)
2. Generate upload key locally:

   ```bash
   keytool -genkey -v -keystore conxius-upload.keystore \
     -alias conxius-upload \
     -keyalg RSA -keysize 2048 -validity 25000 \
     -storepass <SECURE_PASSWORD>
   ```

3. Store keystore securely (NOT in repo). Back up to offline media.
4. Upload the public key to Play Console

---

## 3. Android Build Configuration

### 3.1 Update `android/app/build.gradle.kts`

```kotlin
android {
    val keystorePath = System.getenv("KEYSTORE_PATH")
    val keystorePassword = System.getenv("KEYSTORE_PASSWORD")
    val keyAlias = System.getenv("KEY_ALIAS")
    val keyPassword = System.getenv("KEY_PASSWORD")

    signingConfigs {
        create("release") {
            storeFile = keystorePath?.let { file(it) }
            storePassword = keystorePassword
            this.keyAlias = keyAlias
            this.keyPassword = keyPassword
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

Signing env vars expected at release build time:

- `KEYSTORE_PATH`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

### 3.2 ProGuard Rules

Ensure `proguard-rules.pro` has rules for:

- bitcoinj
- web3j
- Breez SDK
- BouncyCastle

### 3.3 Play Integrity client boundary (not a production gate)

```kotlin
// android/gradle/libs.versions.toml
play-integrity = "1.6.0"

// android/app/build.gradle.kts
implementation(libs.play.integrity)
```

The app's `PlayIntegrityPlugin` uses the Standard API with
`PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` (or the Gradle property
`playIntegrityCloudProjectNumber`) and passes only a deterministic,
URL-safe Base64 representation of the existing SHA-256 authorization request
hash as `requestHash`. The SDK token is returned as an opaque value and is not
decoded, logged, or trusted on-device.

This is client SDK/token acquisition only. Backend token decryption and verdict
verification, request-hash comparison, real-device qualification,
replay/freshness trust policy, and production enforcement are still required
before this becomes a release gate. The separate P-256 KeyMint authorization
boundary does not qualify the existing AES seed/database fallback path or any
Bitcoin/Stacks/secp256k1/Schnorr protocol signing key.

The canonical implementation boundary, qualification matrix, backend checklist,
and non-claims are maintained in the [CON-1544 report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).

---

## 4. Pre-Release Checklist

### Security Verification

- [ ] `bash scripts/ci/validate_android_security.sh` passes, including `FLAG_SECURE`, backup/data-extraction, cleartext, and release-debuggability checks
- [ ] Root detection plugin registered ✅ (DeviceIntegrityPlugin)
- [ ] Mandatory repository-owned, tokenless Gitleaks CLI scan passes with `.gitleaks.toml`
- [ ] Gitleaks scan has no commercial-license secret prerequisite
- [ ] No debug logging of sensitive data
- [ ] All experimental features properly gated
- [ ] Biometric authentication working on physical device
- [ ] StrongBox/TEE behavior verified on a real-device matrix, including explicit StrongBox, TEE-only, API 26–30 legacy evidence, unsupported, Play-installed, and relevant non-Play states
- [ ] Android Key Attestation chain, trust root, revocation, challenge, app identity, security level, verified-boot, and patch-state checks pass on the backend
- [ ] Play Integrity server decryption/verification validates package, signing certificate, canonical request hash, timestamp, and required verdict policy
- [ ] Durable operation nonce/freshness/replay checks and centralized value-operation gate pass negative tests
- [ ] Privacy-minimized telemetry, staged rollout, rollback, and Play/verifier outage runbook are reviewed
- [ ] Independent security review and release acceptance are recorded; client/unit/hosted CI tests are not treated as hardware qualification

### Build Verification

- [ ] `pnpm run build` succeeds
- [ ] `pnpm exec cap sync android` completes without errors
- [ ] `cd android && ./gradlew bundleRelease` produces signed AAB
- [ ] AAB size is reasonable (< 50MB target)
- [ ] All unit tests pass (`pnpm exec vitest run`)
- [ ] E2E tests pass (`pnpm run test:e2e`)
- [ ] Release dependency audit passes with `--require-approved-exceptions` and writes evidence under `$RUNNER_TEMP`

### Compliance

- [ ] Privacy policy hosted and linked
- [ ] Terms of service hosted and linked
- [ ] Data safety form completed in Play Console
- [ ] App does NOT handle fiat directly (partner-powered)
- [ ] "Powered by [Partner]" labels visible for regulated flows
- [ ] No custody of user funds (non-custodial architecture)

### Content

- [ ] App icon (all density buckets present)
- [ ] Splash screen
- [ ] Screenshots for Play Store listing (phone + tablet)
- [ ] Feature graphic (1024x500)
- [ ] Short description (80 chars max)
- [ ] Full description (4000 chars max)

---

## 5. CI/CD Release Pipeline

### GitHub Actions Workflow

Release automation is implemented in `.github/workflows/android-release.yml` and
runs only through `workflow_dispatch`. A normal `publish` has three explicit
stages:

1. **Release Verification and Build** validates the expected `1.9.5` version/tag,
   runs lint, typecheck, unit tests, E2E, web build, dependency audit, Android
   security policy, Android lint, and Android unit tests, installs
   `platforms;android-36` for the modules' `compileSdk = 36`, then builds the
   signed APK and AAB once.
2. **Release Artifact Attestation** downloads the uploaded payload and creates
   provenance for every subject listed in `SHA256SUMS`.
3. **Production Release Publish** requires the separately configured
   `production` environment, verifies every subject attestation and re-extracts
   APK/AAB package identity, version, versionCode, and public signing
   certificate identity without rebuilding. It creates and verifies the
   immutable tag and GitHub Release **before** publishing the exact AAB to the
   fixed Google Play `production` track.

### Dependency audit release gate

The dependency audit is a separate release decision from the signed payload;
it does not change the APK/AAB allowlist, checksum subjects, or attestation
subjects. CI runs the default policy and uploads
`$RUNNER_TEMP/conxius-dependency-audit.json`. Release verification runs:

```bash
pnpm exec node scripts/ci/audit_with_exceptions.mjs \
  --require-approved-exceptions \
  --evidence "$RUNNER_TEMP/conxius-dependency-audit-release.json"
```

The release evidence records the audit timestamp, Node/pnpm versions, audit
totals, advisory/package/version/path counts, each disposition and approval
status, and the current `pnpm-lock.yaml` SHA-256. It is uploaded as a separate
artifact from `$RUNNER_TEMP` and contains no secrets. On the current baseline
the command is expected to fail because the `bigint-buffer` and `elliptic`
exceptions both remain **pending** through **2026-08-19**. The `esbuild` finding
is explicitly `not-affected` for production/release based on the Vite dev-server
scope and the recorded `0.28.1` production-build incompatibility. Do not treat
`CON-1525` or GitHub `#399` as approval evidence, and do not promote until the
two exception records contain real durable approval URL, approver identity, and
approval date.

If the source run's evidence step succeeds but its Google Play step fails or is
cancelled, use the explicit `retry` operation rather than `publish` or `recover`.
Retry requires the source run ID, the source commit SHA, production-environment
approval, and the version-bound literal
`PLAY_NOT_PUBLISHED_<versionCode>`. Before dispatching it, an authorized release
owner must check Google Play for the exact versionCode and confirm that it is
absent and not pending. A retry then downloads the artifact from that exact
source run, verifies its provenance, checksums, metadata, Android identity, and
existing immutable tag/release assets, and republishes the same AAB. It does not
run Gradle, rebuild, create or upload GitHub evidence, or use a different
artifact. If Play's state is ambiguous or the versionCode is present, do not
retry; treat it as an incident and follow the rollback procedure.

The same workflow has an explicit `recover` operation for an Android Release
dispatch whose Google Play publication step completed but which failed while
finalizing release evidence. Recovery requires the source run ID, source commit
SHA, production-environment approval, and the literal `PLAY_PUBLISHED`
confirmation after checking Play Console. It also requires the source run's
Google Play step to be recorded as successful, downloads the payload from that
exact run, re-verifies provenance, checksums, artifact identity, and source
metadata, then idempotently completes or verifies the tag and GitHub Release.
Recovery never runs Gradle, rebuilds artifacts, or invokes the Google Play
upload action; keep it separate from the failed-or-uncertain-publication `retry`
operation.

Repository files cannot create the required branch protection checks, reviewers,
environment, or secrets. See [CI_CD_BASELINE.md](CI_CD_BASELINE.md) for the
external settings that a maintainer must configure and verify.

Required secrets/preconditions:

- `KEYSTORE_BASE64` — Base64-encoded keystore file content
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `ANDROID_SIGNING_CERT_SHA256` — Repository variable containing the expected
  public upload-signing certificate SHA-256 fingerprint, with colons optional
- `PLAY_SERVICE_ACCOUNT_JSON` — Google Play service account JSON in the
  `production` environment

The workflow derives `VERSION_CODE` from the strict `major.minor.patch`
release version using `scripts/ci/derive_android_version_code.mjs`; release
Gradle tasks fail closed when it is missing, non-integer, or non-positive.
Release verification downloads `bundletool-all-1.18.3.jar` from the official
Google bundletool release and checks its pinned SHA-256 before reading AAB
manifest identity. The production job uses GitHub's attestation verifier for
each downloaded subject before any Play or GitHub release mutation.

Keystore encoding helper for `KEYSTORE_BASE64`:

   ```bash
   # Linux
   base64 -w 0 conxius-upload.keystore

   # macOS
   base64 conxius-upload.keystore | tr -d '\n'
   ```

---

## 6. Release Commands (Manual)

The commands below are for local validation and troubleshooting only. They do
not replace the verified-artifact workflow and must not be used to publish a
production APK/AAB or to bypass the `production` environment gate.

```bash
# 0. Export signing env vars (or decode KEYSTORE_BASE64 to a temp file and export KEYSTORE_PATH)
export KEYSTORE_PATH=/absolute/path/to/conxius-upload.keystore
export KEYSTORE_PASSWORD=<STORE_PASSWORD>
export KEY_ALIAS=<KEY_ALIAS>
export KEY_PASSWORD=<KEY_PASSWORD>
export VERSION_CODE="$(node scripts/ci/derive_android_version_code.mjs 1.9.5)"

# 1. Build frontend
pnpm run build

# 2. Sync to Android
pnpm exec cap sync android

# 3. Build signed release AAB
cd android && ./gradlew --no-daemon bundleRelease

# 4. Output at: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Post-Release

- Monitor crash reports in Play Console
- Monitor Play Integrity API responses
- Set up staged rollout (10% → 50% → 100%)
- Enable Play Protect pre-launch report
- Follow [RELEASE_ROLLBACK.md](RELEASE_ROLLBACK.md) if the rollout must be halted or reversed.

---

*This document should be followed step-by-step. Do NOT skip security items.*
