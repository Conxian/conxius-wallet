# Conxius Wallet PRD (Android-First)

## 1. Summary
Conxius is a mobile-first wallet for Bitcoin L1 and Bitcoin-adjacent layers with an Android-secured local vault model and an explicit roadmap toward interlayer execution (Wormhole/NTT). This PRD defines user journeys, requirements, and acceptance criteria aligned with implementation-grade standards.

## 2. Target Users
- **Bitcoin-native user**: wants simple receive/send with reliable confirmations and strong local security.
- **Power user / operator**: uses their own nodes, wants explicit network control, and accepts advanced configuration.
- **Interlayer user**: wants to move assets across domains with recoverable, verifiable workflows.

## 3. Core Journeys
### J1 — First Run (No Wallet Exists)
1. App starts and checks if an encrypted wallet exists.
2. If none exists, onboarding offers create/import.
3. User sets PIN and (optionally) enables biometric/device-credential gate.
4. Wallet created and state persisted.

**Acceptance Criteria**
- No onboarding shown when a wallet exists.
- PIN must meet minimum length rules.
- No mnemonic/passphrase persisted at rest in plaintext.

### J2 — Resume Existing Wallet
1. App detects encrypted wallet exists.
2. User sees lock screen.
3. If biometric gate enabled, user must pass device auth before unlock.
4. User enters PIN to decrypt state.

**Acceptance Criteria**
- Unlock requires device auth when enabled.
- Wrong PIN yields generic failure (no oracle).
- After successful unlock, signing uses session-only seed bytes and wipes memory after use.

### J3 — Emergency Wipe / Create New Wallet
1. From lock screen, user chooses “Create New Wallet”.
2. App confirms destructive action.
3. Vault is wiped; onboarding starts.

**Acceptance Criteria**
- Wipe requires explicit confirmation.
- After wipe, vault no longer exists and app behaves as first run.

### J4 — Send Bitcoin (L1)
1. User enters recipient and amount.
2. App builds PSBT from available UTXOs.
3. User authorizes signing; tx broadcasts.
4. App tracks confirmation state.

**Acceptance Criteria**
- PSBT validates script types; unsupported scripts fail with a clear error.
- Pending txs persist across restarts.
- Confirmation state updates deterministically.

### J5 — Lightning (LND Backend)
1. User configures an LND REST endpoint and scoped macaroon.
2. User pays invoice / LNURL pay and receives explicit result.

**Acceptance Criteria**
- Macaroons treated as secrets: stored only in secure vault, never logged.
- LNURL parsing is strict; user must confirm outbound requests.

### J6 — Bridge / Interlayer Execution (Wormhole/NTT)
1. User initiates a transfer.
2. App creates and signs source tx.
3. App retrieves and verifies attestation/VAA.
4. App creates and signs redemption tx.

**Acceptance Criteria**
- State machine with recoverability at each phase.
- Provider redundancy and verification (no single-source attestation).

## 4. Functional Requirements (MVP + Next)
- **Vault**: encrypted state storage, migration, lock/unlock, wipe.
- **Security controls**: auto-lock policy, duress PIN, biometric gate.
- **BTC L1**: address derivation, UTXO tracking, PSBT creation, signing, broadcast, history.
- **Lightning**: invoice decode, LNURL pay/withdraw support, LND backend integration (scoped).
- **Interlayer**: tracking now; execution milestones defined in roadmap.
- **Notifications**: local notifications for tx and security events.

## 5. Non-Functional Requirements
### Security
- No secrets in logs, analytics, crash reports, or notifications.
- Clear threat model and trust boundaries maintained in WHITEPAPER.
- Credentials classification: seed, vault, macaroons treated as highest sensitivity.

### Reliability
- Offline-safe UI styling and stable startup path.
- Clear retry/backoff strategy for network calls.
- Data providers are pluggable for indexers/bridge APIs.

### Performance
- Fast startup budget with skeleton loading.
- Bundle size targets and code-splitting where practical.

## 6. Observability and Advisories
- Provide user-facing advisories for:\n  - insecure node endpoints\n  - missing backups\n  - biometric session expired\n  - pending txs requiring attention\n+- Internal events drive both toasts and notifications.\n+
## 7. Release Policy
- Semantic Versioning and Keep a Changelog.\n- Each release documents migrations and security-relevant changes.\n+
