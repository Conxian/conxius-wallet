# Android Release Preparation Guide

**Last Updated:** 2026-02-10
**Status:** Pre-release checklist — all items must be completed before Play Store submission.

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

### 3.1 Update `build.gradle`

```groovy
// android/app/build.gradle
android {
    defaultConfig {
        applicationId "com.conxius.wallet"
        versionCode 4          // Increment for each release
        versionName "0.4.0"    // Semantic version
    }
    
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "conxius-upload.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS") ?: "conxius-upload"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3.2 ProGuard Rules

Ensure `proguard-rules.pro` has rules for:

- bitcoinj
- web3j
- Breez SDK
- BouncyCastle

### 3.3 Play Integrity (Optional Enhancement)

```groovy
// Add to dependencies in android/app/build.gradle
implementation 'com.google.android.play:integrity:1.3.0'
```

Then update `DeviceIntegrityPlugin.java` to call Play Integrity API alongside local checks.

---

## 4. Pre-Release Checklist

### Security Verification

- [ ] `FLAG_SECURE` is set in `MainActivity.kt` ✅ (verified)
- [ ] Root detection plugin registered ✅ (DeviceIntegrityPlugin)
- [ ] No secrets in source code (run TruffleHog)
- [ ] No debug logging of sensitive data
- [ ] All experimental features properly gated
- [ ] Biometric authentication working on physical device
- [ ] StrongBox/TEE enforcement verified on target devices

### Build Verification

- [ ] `npm run build` succeeds
- [ ] `npx cap sync` completes without errors
- [ ] `./gradlew assembleRelease` produces signed APK
- [ ] APK size is reasonable (< 50MB target)
- [ ] All unit tests pass (`npm test` — 106/106 ✅)
- [ ] E2E tests pass (`npm run test:e2e`)

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

The existing `.github/workflows/ci.yml` handles build/test. For release:

1. Add secrets to GitHub repo settings:
   - `KEYSTORE_BASE64` — Base64-encoded keystore file
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`
   - `PLAY_SERVICE_ACCOUNT_JSON` — Google Play service account key

2. Add a release workflow that:
   - Builds production frontend: `npm run build`
   - Syncs Capacitor: `npx cap sync`
   - Builds signed AAB: `./gradlew bundleRelease`
   - Uploads to Play Console via `r0adkll/upload-google-play`

---

## 6. Release Commands (Manual)

```bash
# 1. Build frontend
npm run build

# 2. Sync to Android
npx cap sync

# 3. Build release AAB (requires signing config)
cd android && ./gradlew bundleRelease

# 4. Output at: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Post-Release

- Monitor crash reports in Play Console
- Monitor Play Integrity API responses
- Set up staged rollout (10% → 50% → 100%)
- Enable Play Protect pre-launch report

---

*This document should be followed step-by-step. Do NOT skip security items.*
