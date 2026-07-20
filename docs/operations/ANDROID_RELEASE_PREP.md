---
title: Android Release Preparation Guide
layout: page
permalink: /docs/android-release-prep
---

# Android Release Preparation Guide

**Last Updated:** 2026-07-20
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

- **Play Integrity API** — Required for `DeviceIntegrityPlugin.java` to use Google's attestation
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
5. Data safety: Declare that app does NOT collect or share user data

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

### 3.3 Play Integrity (Optional Enhancement)

```kotlin
// Add to dependencies in android/app/build.gradle.kts
implementation("com.google.android.play:integrity:1.3.0")
```

Then update `DeviceIntegrityPlugin.java` to call Play Integrity API alongside local checks.

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
- [ ] StrongBox/TEE enforcement verified on target devices

### Build Verification

- [ ] `pnpm run build` succeeds
- [ ] `pnpm exec cap sync android` completes without errors
- [ ] `cd android && ./gradlew bundleRelease` produces signed AAB
- [ ] AAB size is reasonable (< 50MB target)
- [ ] All unit tests pass (`pnpm exec vitest run`)
- [ ] E2E tests pass (`pnpm run test:e2e`)

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
runs only through `workflow_dispatch`. It has three explicit stages:

1. **Release Verification and Build** validates the expected `1.9.5` version/tag,
   runs lint, typecheck, unit tests, E2E, web build, dependency audit, Android
   security policy, Android lint, and Android unit tests, then builds the signed
   APK and AAB once.
2. **Release Artifact Attestation** downloads the uploaded payload and creates
   provenance for every subject listed in `SHA256SUMS`.
3. **Production Release Publish** requires the separately configured
   `production` environment, verifies every subject attestation and re-extracts
   APK/AAB package identity, version, versionCode, and public signing
   certificate identity without rebuilding, then publishes the exact AAB to the
   fixed Google Play `production` track and GitHub release. There is no
   skip/bypass input.

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
