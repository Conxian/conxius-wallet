import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertReleasePolicy,
  assertSafeEvidencePath,
  buildEvidence,
  evaluateAuditReport,
  validateLedger,
  writeEvidence,
} from '../../scripts/ci/audit_with_exceptions.mjs';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const ledgerPath = resolve(repositoryRoot, 'scripts/ci/dependency-audit-exceptions.json');
const reportPath = resolve(repositoryRoot, 'tests/ci/fixtures/dependency-audit-report.json');
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

    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/placeholder|durable HTTPS URL/);

    ledger.records[0].approval = {
      status: 'approved',
      reference: 'https://github.com/Conxian/conxius-wallet/issues/399#issuecomment-123',
      approver: 'TBD',
      approvedOn: '2026-07-22',
    };
    expect(() => validateLedger(ledger, { today: '2026-07-22' })).toThrow(/placeholder/);
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
      counts: { advisories: 3, packages: 3, observedVersions: 3, paths: 5 },
      dispositions: { approvalStatusCounts: { pending: 2, approved: 0, 'not-applicable': 1 } },
      lockfile: { path: 'pnpm-lock.yaml' },
    });
    expect(() => assertSafeEvidencePath(resolve(repositoryRoot, 'evidence.json'))).toThrow(/temporary/);
    expect(assertSafeEvidencePath(evidencePath)).toBe(evidencePath);
  });
});
