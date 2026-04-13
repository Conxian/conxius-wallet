# Independent Verification Pathway (CON-346)

## Purpose
Ensure that all implementation changes are independently verified using automated tools and structured evidence sources to prevent self-attestation bias.

## Verification Lanes

### 1. Fast Track (TypeScript)
- **Scope**: All files in `services/` and `components/`.
- **Tools**: `vitest`, `eslint`, `tsc`.
- **Command**: `pnpm test && pnpm lint`

### 2. Security Audit (CXN Guardian)
- **Scope**: PII and Secret egress.
- **Tools**: `services/ai-security.ts` test suite.
- **Command**: `pnpm test tests/ai-security.test.ts`

### 3. E2E Validation (Playwright)
- **Scope**: Integration flows (Swap, Bridge, Payment).
- **Tools**: `playwright`.
- **Command**: `pnpm run test:e2e`

### 4. Agent Verification (Jules)
- **Scope**: Cross-repo alignment and Linear status reconciliation.
- **Protocol**:
  1. Scan Linear for Urgent/High issues.
  2. Map issues to codebase segments.
  3. Implement fix + automated test.
  4. Record evidence in Linear comments.


## Handoff & External Execution (Jules)
For automated remediation and verification, use the following protocol:
1. **Trigger**: Apply the `jules` label to the GitHub issue.
2. **Context**: Ensure the issue contains a clear "Acceptance Criteria" block.
3. **Execution**: Jules will clone the repo, init submodules, run tests, and open a PR with the fix.

## Submodule Strategy
- **Platform**: `conxius-platform`
- **Core**: `lib-conxian-core`
- **Command**: `git submodule update --init --recursive` before running system-level checks.
