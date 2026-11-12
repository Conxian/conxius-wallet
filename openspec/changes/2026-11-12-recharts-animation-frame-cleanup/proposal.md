# Recharts animation-frame test cleanup after jsdom teardown

## Context

The exact Wallet dev candidate `997c1c57534eb50dbf74d95b506e41b580395864` fails the Unit Tests workflow after the rendering assertions pass. Vitest reports two unhandled asynchronous `ReferenceError: window is not defined` exceptions from the `cancelAnimationFrame` shim when a queued cancellation runs after the per-file jsdom global has been disposed.

The test-only shim currently delegates both scheduling and cancellation through `window`. The late callback must not depend on a browser global that may already have been removed by the test runner.

## Selected change

Use `globalThis.setTimeout` and `globalThis.clearTimeout` for the test-only request/cancel animation-frame shim. These timer functions remain available when Vitest restores the Node global after jsdom teardown.

## Non-goals

- No production UI or animation behavior changes.
- No Vitest environment downgrade or removal of jsdom.
- No retries, test exclusions, assertion weakening, dependency or lockfile changes.
- No CI workflow, release validator, CODEOWNERS or promotion-policy changes.
- No signing, payment, wallet-state or deployment operation.

## Acceptance

1. The focused Recharts rendering test passes on the exact feature head.
2. The complete Wallet Unit Tests job finishes with zero unhandled errors.
3. Existing type, lint, dependency and security checks remain unchanged and pass where applicable.
4. A distinct human reviewer approves the exact feature-to-dev head before integration.
5. A fresh dev-to-staged successor is generated only after normal integration; immutable Wallet #1009 is not amended.
