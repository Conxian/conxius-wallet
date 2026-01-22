# Align Conxius Wallet Implementation and Build Pipeline

## Purpose

- Keep build + runtime notes aligned to the repo’s actual implementation.
- Keep this document focused on packaging, Android build, and app-shell integration (not product scope).

## Findings

- QR generation is local (no external QR API). Receive uses client-side rendering via `qrcode` in [Dashboard.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Dashboard.tsx).
- Payment QR scanning is wired using `@zxing/browser` camera decoding in [PaymentPortal.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/PaymentPortal.tsx).
- Mode switching is implemented in onboarding with Sovereign vs Simulation selection in [Onboarding.tsx:L85-L149](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Onboarding.tsx#L85-L149). App initializes and displays mode badges in [App.tsx:L49-L66](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/App.tsx#L49-L66) and [App.tsx:L270-L287](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/App.tsx#L270-L287). Components gate mock data by mode in [Marketplace.tsx:L39-L46](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Marketplace.tsx#L39-L46) and [DeFiDashboard.tsx:L14-L20](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/DeFiDashboard.tsx#L14-L20).
- Android build is set up with Capacitor and Gradle; assets including modulepreload polyfill are present in dist and mirrored under Android assets, e.g., [dist index-DG2MOa1i.js:L4-L25](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/dist/assets/index-DG2MOa1i.js#L4-L25) and [android assets index-DG2MOa1i.js:L4-L25](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/android/app/src/main/assets/public/assets/index-DG2MOa1i.js#L4-L25).
- Capacitor versions are aligned at 8.x in [package.json](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/package.json).
- A diagnostics screen exists in [SystemDiagnostics.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/SystemDiagnostics.tsx); use that as the runtime diagnostics anchor (not a document tag).
- Android toolchain: app module compiles with Java 17 in [android/app/build.gradle](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/android/app/build.gradle). Capacitor also generates a `capacitor.build.gradle` file that may target a different Java level; do not edit it directly (it is regenerated on `cap sync/update`).

## Alignment Plan

### QR Code Reliability and UX

- Keep QR generation local to the device (already implemented) and ensure the receive QR always renders even when offline.
- Normalize size, contrast and error correction level; ensure loading and error states on [Dashboard.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Dashboard.tsx).

### Sovereign Mode Data Gating

- Confirm that Marketplace and DeFi dashboards strictly hide mock data in Sovereign mode ([Marketplace.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Marketplace.tsx), [DeFiDashboard.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/DeFiDashboard.tsx)). Replace placeholders with clear “Coming soon / offline” messaging where needed.
- Persist the chosen AppMode from onboarding and ensure rehydration on app start ([Onboarding.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/Onboarding.tsx), [App.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/App.tsx)).

### QR Scanner Wiring

- Keep QR scanning implemented using `@zxing/browser` and validate Android WebView camera permissions for Capacitor builds ([PaymentPortal.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/PaymentPortal.tsx)).
- Ensure both BIP21 and Lightning QR content paths are validated (manual paste remains the fallback).

### Capacitor and Build Pipeline Alignment

- Keep @capacitor/cli aligned to 8.x to match @capacitor/core/android. Re-sync and verify native runtime assets are correctly copied.
- Confirm webDir is set to “dist” in [capacitor.config.json](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/capacitor.config.json) and that assets from dist are present under Android assets.
- Validate Gradle and Android plugin versions in [android/build.gradle](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/android/build.gradle) and SDK levels in [variables.gradle](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/android/variables.gradle).

### Java Environment Setup

- Install JDK (17 recommended for AGP 8.x), set JAVA_HOME and PATH. Verify with java -version.
- If needed, set org.gradle.java.home in gradle.properties for consistent builds.

### Diagnostics and Logging

- Use [SystemDiagnostics.tsx](file:///c:/Users/bmokoka/anyachainlabs/conxius-wallet/components/SystemDiagnostics.tsx) as the runtime diagnostics anchor for network reachability and basic health checks.
- Keep logging minimal and avoid secrets (PIN, seed, vault blob, macaroons).

### Testing and Verification

- Unit test BIP21 generation and QR rendering fallbacks.
- UI test mode gating to ensure Sovereign mode shows no mock data.
- Build Android debug, install, and validate: QR displays, scanning works, and receive flow is functional.
- Confirm assets load without blank screens; verify modulepreload polyfill presence in Android assets.

### Risk Management and Backward Compatibility

- Keep Simulation mode fully functional; changes gated behind mode checks.
- Use feature flags for QR scanner to avoid build instability on platforms without camera permissions.

## Acceptance Criteria

- Capacitor dependencies aligned at 8.x; cap sync completes and Android assets load without blank screens.
- Java runtime configured; Gradle builds the Android app.
- Receive screen QR renders reliably offline (local generation) with correct BIP21 data.
- Sovereign mode shows no mock Marketplace/DeFi data; Simulation remains unchanged.
- PaymentPortal supports QR scanning (camera) plus manual paste fallback.
- No stray “#problems_and_diagnostics” references.

## Next Steps

- Proceed to implement the above changes, verify with a debug build, and provide a test report and APK for installation.
