# Conxius Wallet

Mobile-first sovereign wallet with a hardened local enclave model.

## What This Repo Contains

- React + Vite UI bundled with Tailwind CSS (offline-safe; no CDN dependency)
- Android app via Capacitor
- Local vault model
  - Encrypted wallet state persisted on-device
  - PIN-based encryption
  - Optional biometric/device-credential gate on Android Keystore keys

## Wallet Lifecycle

- If an encrypted wallet exists on-device, the app resumes it by showing the lock screen.
- If no wallet exists, the app starts onboarding to create/import a new wallet.
- From the lock screen, you can wipe the vault and create a new wallet (destructive).

## Development

**Prerequisites**

- Node.js
- Android Studio + Android SDK (for device installs)

**Install**

- `npm install`

**Run web**

- `npm run dev`

**Build web**

- `npm run build`

## Android

**Build + install debug**

- `cd android && .\\gradlew.bat :app:installDebug`

**Sync web assets into Android**

- `npx cap copy android`

## Roadmap

- See [ROADMAP.md](ROADMAP.md)

## Project Docs

- [WHITEPAPER.md](WHITEPAPER.md)
- [PRD.md](PRD.md)
- [CHANGELOG.md](CHANGELOG.md)
