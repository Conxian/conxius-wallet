---
title: Mobile Testing Guide
layout: page
permalink: /docs/mobile-testing
---

# Mobile Testing Guide (Android)

This document outlines how to test Conxius Wallet on physical Android devices.

## 1. Prerequisites

- **Hardware**: Android Device (Android 10+ recommended for StrongBox support).
- **Software**: 
  - Android Studio (latest stable)
  - Java JDK 17 or 21 (matches `build.gradle` sourceCompatibility)
  - Node.js & npm
- **Device Setup**:
  - Enable **Developer Options** (Tap Build Number 7 times).
  - Enable **USB Debugging**.
  - Connect via USB.

## 2. Manual Testing on Device

To deploy the current code to your connected device:

```bash
# 1. Build the web assets
pnpm run build

# 2. Sync web assets to the Android native project
pnpm cap sync

# 3. Run on the connected device (selects the first available device)
pnpm cap run android
```

*Note: If multiple devices/emulators are connected, you may need to select the target.*

Alternatively, to open the project in Android Studio and run from there (provides better logcat output):

```bash
pnpm cap open android
```

## 3. Automated Instrumentation Tests

These tests run **on the device** and verify native functionality (e.g., Keystore access, Biometrics).

### Location
Tests are located in: `android/app/src/androidTest/java/`

### Running Tests (Command Line)

```bash
cd android
./gradlew connectedAndroidTest
```

Results will be generated in `android/app/build/reports/androidTests/connected/`.

### Running Tests (Android Studio)
1. Open project (`pnpm cap open android`).
2. Navigate to `app > src > androidTest > java`.
3. Right-click a test class (e.g., `ExampleInstrumentedTest`) and select **Run**.

## 4. Debugging

### Logcat (Native Logs)
View native logs, including Capacitor plugin outputs and System.out:

```bash
# Using adb directly
adb logcat -s "Capacitor" "Conxius" "System.out" *:E
```

### WebView Debugging (Chrome DevTools)
Debug the JavaScript/React app running inside the Android WebView:

1. Open Chrome on your PC.
2. Navigate to `chrome://inspect/#devices`.
3. Locate your device and the "Conxius" target.
4. Click **Inspect** to open full DevTools (Console, Network, Sources).

## 5. Common Issues & Troubleshooting

### `google-services.json` Missing
- **Symptom**: Warning during build `google-services.json not found`.
- **Impact**: Push notifications (FCM) will not work.
- **Fix**: Obtain `google-services.json` from the Firebase Console (if you have access) and place it in `android/app/`. For local dev/testing without push, this can be ignored.

### Keystore/Signing Errors
- **Symptom**: Build fails during `assembleRelease`.
- **Fix**: Debug builds (`pnpm cap run android` uses debug by default) auto-sign with a debug key. For release testing, follow [Android Release Prep](./ANDROID_RELEASE_PREP.md) to set up signing environment variables.

### Biometric Auth Failing
- **Symptom**: Biometric prompt doesn't appear or fails immediately.
- **Fix**: Ensure the device has a Screen Lock (PIN/Pattern) set up and at least one biometric credential enrolled. Enulators require configuring "Virtual Sensors" in the extended controls.

### "Webview process crashed"
- **Cause**: Often due to Out-Of-Memory (OOM) on low-end devices handling large crypto operations (e.g. Scrypt).
- **Fix**: Check `adb logcat`. Conxius uses "Zero-Leak" memory patterns, but ensure you aren't loading massive arrays into the JS heap unnecessarily.
