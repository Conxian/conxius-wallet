import { afterEach, describe, expect, it } from 'vitest';
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertReleasePolicy,
  assertSafeEvidencePath,
  buildEvidence,
  buildFailureEvidence,
  evaluateAuditReport,
  runPolicy,
  validateLedger,
  writeEvidence,
} from '../../scripts/ci/audit_with_exceptions.mjs';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const ledgerPath = resolve(repositoryRoot, 'scripts/ci/dependency-audit-exceptions.json');
const reportPath = resolve(repositoryRoot, 'tests/ci/fixtures/dependency-audit-report.json');
const lockfilePath = resolve(repositoryRoot, 'pnpm-lock.yaml');
const baseLedger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const baseReport = JSON.parse(readFileSync(reportPath, 'utf8'));
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function evaluate(report = baseReport, ledger = baseLedger) {
  return evaluateAuditReport(report, ledger, { today: '2026-07-22' });
}

function fakeSpawn({ auditStatus = 1, auditSignal = null, auditStdout = JSON.stringify(baseReport), auditStderr = '' } = {}) {
  return (_command, args) => {
    if (args[0] === 'audit') {
      return { status: auditStatus, signal: auditSignal, stdout: auditStdout, stderr: auditStderr };
    }
    return { status: 0, signal: null, stdout: '11.13.0\n', stderr: '' };
  };
}

describe('dependency audit disposition policy', () => {
  it('accepts the current fixture report and versioned ledger', () => {
    const result = evaluate();

    expect(result.audit.findings).toHaveLength(3);
    expect(result.dispositionCounts).toEqual({ 'not-affected': 1, exception: 2 });
    expect(result.approvalStatusCounts).toEqual({ pending: 2, approved: 0, 'not-applicable': 1 });
    expect(result.pendingExceptions.map((record) => record.advisory)).toEqual([
      'GHSA-3gc7-fjrx-p6mg',
      'GHSA-848j-6mx2-7j84',
    ]);
    expect(result.audit.findings.map(({ advisory, pathCount, roleClassification, reachabilityFingerprint }) => ({
      advisory,
      pathCount,
      roleClassification,
      reachabilityFingerprint,
    }))).toEqual([
      {
        advisory: 'GHSA-3gc7-fjrx-p6mg',
        pathCount: 14,
        roleClassification: 'production',
        reachabilityFingerprint: '9986acccd9f9294e02f9d2813c7b54e100778b307993ead4a11f04e3d505b470',
      },
      {
        advisory: 'GHSA-848j-6mx2-7j84',
        pathCount: 100,
        roleClassification: 'production',
        reachabilityFingerprint: 'de8cf46ae22c223b19e7ff856c9fb13c107a868c05edf08eef969ffbcd31c000',
      },
      {
        advisory: 'GHSA-g7r4-m6w7-qqqr',
        pathCount: 9,
        roleClassification: 'optional',
        reachabilityFingerprint: 'd168750cffc66131e823d5d751169a177c652c7b4552ad986a9b5f0e598a7359',
      },
    ]);
  });

  it('rejects an unknown/new audit advisory without a disposition', () => {
    const report = clone(baseReport);
    report.advisories['9999999'] = {
      github_advisory_id: 'GHSA-aaaa-bbbb-cccc',
      module_name: 'new-package',
      severity: 'low',
      findings: [{ version: '1.2.3', paths: ['.>new-package'], dev: false, optional: false, bundled: false }],
    };

    expect(() => evaluate(report)).toThrow(/Missing disposition for current advisory GHSA-aaaa-bbbb-cccc/);
  });

  it('rejects duplicate ledger and audit advisory identifiers', () => {
    const ledger = clone(baseLedger);
    ledger.records.push(clone(ledger.records[0]));
    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/is duplicated/);

    const report = clone(baseReport);
    report.advisories['9999999'] = clone(report.advisories['1103747']);
    expect(() => evaluate(report)).toThrow(/pnpm audit advisory GHSA-3gc7-fjrx-p6mg is duplicated/);
  });

  it('rejects stale ledger entries after a finding is fixed', () => {
    const report = clone(baseReport);
    delete report.advisories['1120680'];

    expect(() => evaluate(report)).toThrow(/Stale ledger entry GHSA-g7r4-m6w7-qqqr/);
  });

  it.each([
    ['package', (report) => { report.advisories['1120680'].module_name = 'vite'; }],
    ['severity', (report) => { report.advisories['1120680'].severity = 'moderate'; }],
    ['observed version', (report) => { report.advisories['1120680'].findings[0].version = '0.28.1'; }],
    ['dependency path', (report) => { report.advisories['1120680'].findings[0].paths[0] = '.>vite>esbuild>replacement'; }],
    ['path count', (report) => { report.advisories['1120680'].findings[0].paths.push('.>another>esbuild'); }],
    ['role flags', (report) => { report.advisories['1120680'].findings[0].optional = false; }],
  ])('rejects %s drift between audit and ledger', (_label, mutate) => {
    const report = clone(baseReport);
    mutate(report);

    expect(() => evaluate(report)).toThrow(/drift/);
  });

  it('rejects malformed and expired exceptions', () => {
    const missingOwner = clone(baseLedger);
    delete missingOwner.records[0].owner;
    expect(() => validateLedger(missingOwner, { today: '2026-07-22' })).toThrow(/missing owner/);

    const expired = clone(baseLedger);
    expired.records[0].expiresOn = '2026-07-21';
    expect(() => validateLedger(expired, { today: '2026-07-22' })).toThrow(/expired/);
  });

  it('allows pending exceptions in default mode but blocks release mode', () => {
    const result = evaluate();

    expect(() => assertReleasePolicy(result)).not.toThrow();
    expect(() => assertReleasePolicy(result, { requireApprovedExceptions: true })).toThrow(
      /Release dependency audit blocked[\s\S]*GHSA-3gc7-fjrx-p6mg[\s\S]*GHSA-848j-6mx2-7j84/,
    );
  });

  it('rejects placeholder approval evidence', () => {
    const ledger = clone(baseLedger);
    ledger.records[0].approval = {
      status: 'approved',
      reference: 'https://example.com/approval',
      approver: 'TBD',
      approvedOn: '2026-07-22',
    };

    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/canonical|placeholder/);

    ledger.records[0].approval = {
      status: 'approved',
      reference: 'https://github.com/Conxian/conxius-wallet/issues/399#issuecomment-123',
      approver: 'TBD',
      approvedOn: '2026-07-22',
    };
    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/placeholder/);
  });

  it.each([
    'https://linear.app/conxian-labs/issue/CON-1525/dependency-advisories#comment-4ec076dd-6fca-4375-a26f-75d467b2218a',
    'https://github.com/Conxian/conxius-wallet/issues/399#issuecomment-123',
    'https://github.com/Conxian/conxius-wallet/pull/399#discussion_r123',
  ])('accepts canonical approval comment reference %s', (reference) => {
    const ledger = clone(baseLedger);
    ledger.records[0].approval = {
      status: 'approved',
      reference,
      approver: 'Conxian security maintainer',
      approvedOn: '2026-07-22',
    };

    expect(() => validateLedger(ledger, { today: '2026-07-22' })).not.toThrow();
  });

  it.each([
    'https://linear.app/',
    'https://linear.app/conxian-labs/issue/CON-1525',
    'https://linear.app.evil.example/conxian-labs/issue/CON-1525#comment-123',
    'https://linear.app/conxian-labs/issue/CON-1525#comment-123?token=secret',
    'https://attacker.example/conxian-labs/issue/CON-1525#comment-123',
    'https://user:password@github.com/Conxian/conxius-wallet/issues/399#issuecomment-123',
    'https://github.com/Conxian/other-repo/issues/399#issuecomment-123',
    'https://github.com/Conxian/conxius-wallet/issues/399',
  ])('rejects non-canonical approval reference %s', (reference) => {
    const ledger = clone(baseLedger);
    ledger.records[0].approval = {
      status: 'approved',
      reference,
      approver: 'Conxian security maintainer',
      approvedOn: '2026-07-22',
    };

    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/canonical/);
  });

  it('requires concrete evidence for not-affected records', () => {
    const ledger = clone(baseLedger);
    ledger.records[2].evidence = [];

    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/concrete evidence/);
  });

  it('builds and writes non-secret evidence only under temporary paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-'));
    temporaryRoots.push(root);
    const lockfilePath = join(root, 'pnpm-lock.yaml');
    writeFileSync(lockfilePath, 'lockfile fixture\n');
    const result = evaluate();
    const evidence = buildEvidence({
      report: baseReport,
      evaluation: result,
      nodeVersion: 'v22.23.1',
      pnpmVersion: '11.13.0',
      lockfilePath,
      generatedAt: '2026-07-22T12:00:00.000Z',
    });
    const evidencePath = join(root, 'evidence.json');
    writeEvidence(evidencePath, evidence);

    expect(JSON.parse(readFileSync(evidencePath, 'utf8'))).toMatchObject({
      generatedAt: '2026-07-22T12:00:00.000Z',
      nodeVersion: 'v22.23.1',
      pnpmVersion: '11.13.0',
      counts: { advisories: 3, packages: 3, observedVersions: 3, paths: 123 },
      dispositions: { approvalStatusCounts: { pending: 2, approved: 0, 'not-applicable': 1 } },
      lockfile: { path: 'pnpm-lock.yaml' },
    });
    expect(statSync(evidencePath).mode & 0o777).toBe(0o600);
    expect(() => assertSafeEvidencePath(resolve(repositoryRoot, 'evidence.json'))).toThrow(/temporary/);
    expect(() => assertSafeEvidencePath(evidencePath)).toThrow(/must not already exist/);
    expect(() => writeEvidence(evidencePath, evidence)).toThrow(/must not already exist/);

    const existingContents = readFileSync(evidencePath, 'utf8');
    expect(existingContents).toContain('2026-07-22T12:00:00.000Z');

    const symlinkTarget = join(root, 'symlink-target.json');
    const symlinkPath = join(root, 'symlink-evidence.json');
    writeFileSync(symlinkTarget, 'target\n');
    symlinkSync(symlinkTarget, symlinkPath);
    expect(readlinkSync(symlinkPath)).toBe(symlinkTarget);
    expect(() => assertSafeEvidencePath(symlinkPath)).toThrow(/symbolic link/);
    expect(() => writeEvidence(symlinkPath, evidence)).toThrow(/symbolic link/);
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
  });
});

describe('dependency audit process and failure evidence handling', () => {
  it.each([0, 1])('accepts pnpm audit exit status %s when JSON is valid', (auditStatus) => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-status-'));
    temporaryRoots.push(root);
    const evidencePath = join(root, `status-${auditStatus}.json`);

    const result = runPolicy({
      ledgerPath,
      lockfilePath,
      evidencePath,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn({ auditStatus }),
    });

    expect(result.evidence.auditExitCode).toBe(auditStatus);
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(evidence.auditExitCode).toBe(auditStatus);
    expect(evidence).not.toHaveProperty('failure');
  });

  it.each([
    { name: 'status 2', auditStatus: 2, auditSignal: null, code: 'audit_exit_unexpected' },
    { name: 'null status', auditStatus: null, auditSignal: null, code: 'audit_exit_unexpected' },
    { name: 'signal termination', auditStatus: null, auditSignal: 'SIGTERM', code: 'audit_signal' },
  ])('fails closed for $name and writes sanitized evidence', ({ auditStatus, auditSignal, code }) => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-exit-'));
    temporaryRoots.push(root);
    const evidencePath = join(root, 'failure.json');

    expect(() => runPolicy({
      ledgerPath,
      lockfilePath,
      evidencePath,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn({ auditStatus, auditSignal, auditStderr: 'SECRET pnpm stderr should never escape' }),
    })).toThrow(/unexpected exit status|terminated/);

    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(evidence).toMatchObject({
      mode: 'default',
      auditExitCode: auditStatus,
      failure: { code },
      lockfile: { path: 'pnpm-lock.yaml' },
    });
    expect(JSON.stringify(evidence)).not.toContain('SECRET');
  });

  it('rejects invalid JSON without including pnpm stderr', () => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-json-'));
    temporaryRoots.push(root);
    const evidencePath = join(root, 'invalid-json.json');

    expect(() => runPolicy({
      ledgerPath,
      lockfilePath,
      evidencePath,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn({ auditStdout: '{not-json', auditStderr: 'SECRET pnpm stderr should never escape' }),
    })).toThrow(/valid JSON/);

    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(evidence.failure).toEqual({
      code: 'audit_invalid_json',
      message: 'pnpm audit did not return valid JSON.',
    });
    expect(JSON.stringify(evidence)).not.toContain('SECRET');
  });

  it('writes structured evidence for evaluation drift and release pending approval', () => {
    const driftRoot = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-drift-'));
    temporaryRoots.push(driftRoot);
    const driftEvidencePath = join(driftRoot, 'drift.json');
    const driftReport = clone(baseReport);
    driftReport.advisories['1120680'].findings[0].paths[0] = '.>vite>esbuild>replacement';

    expect(() => runPolicy({
      ledgerPath,
      lockfilePath,
      evidencePath: driftEvidencePath,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn({ auditStdout: JSON.stringify(driftReport) }),
    })).toThrow(/drift/);
    expect(JSON.parse(readFileSync(driftEvidencePath, 'utf8'))).toMatchObject({
      failure: { code: 'evaluation_drift' },
    });

    const releaseRoot = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-release-'));
    temporaryRoots.push(releaseRoot);
    const releaseEvidencePath = join(releaseRoot, 'release.json');
    expect(() => runPolicy({
      ledgerPath,
      lockfilePath,
      evidencePath: releaseEvidencePath,
      requireApprovedExceptions: true,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn(),
    })).toThrow(/Release dependency audit blocked/);
    expect(JSON.parse(readFileSync(releaseEvidencePath, 'utf8'))).toMatchObject({
      mode: 'release',
      failure: { code: 'release_pending_approval' },
    });
  });

  it('writes a sanitized failure envelope for an invalid ledger manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-dependency-audit-manifest-'));
    temporaryRoots.push(root);
    const invalidLedgerPath = join(root, 'ledger.json');
    const evidencePath = join(root, 'manifest.json');
    const invalidLedger = clone(baseLedger);
    delete invalidLedger.records[0].pathCount;
    writeFileSync(invalidLedgerPath, `${JSON.stringify(invalidLedger)}\n`);

    expect(() => runPolicy({
      ledgerPath: invalidLedgerPath,
      lockfilePath,
      evidencePath,
      today: '2026-07-22',
      spawnSyncImpl: fakeSpawn({ auditStderr: 'SECRET pnpm stderr should never escape' }),
    })).toThrow(/pathCount/);
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(evidence.failure).toEqual({
      code: 'ledger_invalid',
      message: 'The dependency audit ledger is invalid.',
    });
    expect(JSON.stringify(evidence)).not.toContain('SECRET');
  });

  it('builds a failure envelope with a current lockfile digest', () => {
    const evidence = buildFailureEvidence({
      lockfilePath,
      generatedAt: '2026-07-22T12:00:00.000Z',
      mode: 'release',
      auditExitCode: null,
      failureCode: 'audit_signal',
    });

    expect(evidence).toMatchObject({
      generatedAt: '2026-07-22T12:00:00.000Z',
      mode: 'release',
      auditExitCode: null,
      failure: { code: 'audit_signal' },
      lockfile: { path: 'pnpm-lock.yaml' },
    });
    expect(evidence.lockfile.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
