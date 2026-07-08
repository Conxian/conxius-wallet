# Testing & Verification Standards

Conxius Wallet enforces strict multi-layered testing to ensure sovereignty and security.

## Testing Layers

- **Unit Tests**: Vitest for TypeScript services and logic.
- **Native Tests**: JUnit for Kotlin managers and enclave primitives.
- **E2E Tests**: Playwright for web/BFF flows.
- **Maestro Specs**: Mobile-native UI automation for Android.

## CI/CD Gating

All pull requests must pass:
1. Linting (ESLint)
2. Type-checking (TSC)
3. Unit tests
4. Security scanning (Gitleaks, GitGuardian)
5. Runtime contamination guards (CON-393)

---
*Refer to [Operating Model](../operations/OPERATING_MODEL.md) for approval paths.*
