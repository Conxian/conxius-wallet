import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER_SCHEMA_VERSION = 1;
export const AUDIT_COMMAND = ['audit', '--audit-level=low', '--json'];
export const AUDIT_SEVERITIES = ['low', 'moderate', 'high', 'critical'];

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
export const DEFAULT_LEDGER_PATH = resolve(scriptDir, 'dependency-audit-exceptions.json');
export const DEFAULT_LOCKFILE_PATH = resolve(scriptDir, '../../pnpm-lock.yaml');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ADVISORY_PATTERN = /^(?:GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|CVE-\d{4}-\d{4,})$/;
const PLACEHOLDER_PATTERN = /^(?:$|tbd|todo|unknown|pending|n\/a|none|example(?:\.com)?|placeholder)$/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, context) {
  if (!isObject(value)) {
    throw new Error(`${context} must be an object.`);
  }
}

function assertExactKeys(value, allowedKeys, requiredKeys, context) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unsupported field ${key}.`);
    }
  }
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${context} is missing ${key}.`);
    }
  }
}

function assertNonEmptyString(value, context) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value.trim();
}

function assertNonPlaceholder(value, context) {
  if (PLACEHOLDER_PATTERN.test(value.trim())) {
    throw new Error(`${context} must not be a placeholder value.`);
  }
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function assertDate(value, context, today, { allowFuture = false } = {}) {
  if (!isIsoDate(value)) {
    throw new Error(`${context} must be a valid ISO date (YYYY-MM-DD).`);
  }
  if (!allowFuture && value > today) {
    throw new Error(`${context} cannot be in the future: ${value}.`);
  }
  return value;
}

function assertVersion(value, context) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new Error(`${context} must be an exact semantic version.`);
  }
  return value;
}

function assertAdvisoryId(value, context) {
  if (typeof value !== 'string' || !ADVISORY_PATTERN.test(value)) {
    throw new Error(`${context} must be a GHSA or CVE advisory identifier.`);
  }
  return value;
}

function assertSeverity(value, context) {
  if (!AUDIT_SEVERITIES.includes(value)) {
    throw new Error(`${context} has unsupported severity ${value}.`);
  }
  return value;
}

function normaliseVersions(values, context) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${context} must be a non-empty array.`);
  }
  const versions = values.map((value, index) => assertVersion(value, `${context}[${index}]`));
  if (new Set(versions).size !== versions.length) {
    throw new Error(`${context} must not contain duplicate versions.`);
  }
  return [...versions].sort();
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertAllowedEvidenceUrl(value, context) {
  assertNonEmptyString(value, context);
  assertNonPlaceholder(value, context);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${context} must be a durable HTTPS URL.`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.pathname === '/' || /(?:example|invalid|localhost)/i.test(url.hostname)) {
    throw new Error(`${context} must be a durable HTTPS URL, not a placeholder.`);
  }
}

function validateApproval(approval, context, today) {
  assertObject(approval, context);
  if (approval.status === 'pending') {
    assertExactKeys(approval, ['status', 'reference'], ['status', 'reference'], context);
    assertNonEmptyString(approval.reference, `${context}.reference`);
    assertNonPlaceholder(approval.reference, `${context}.reference`);
    return { status: 'pending', reference: approval.reference.trim() };
  }

  if (approval.status === 'approved') {
    assertExactKeys(
      approval,
      ['status', 'reference', 'approver', 'approvedOn'],
      ['status', 'reference', 'approver', 'approvedOn'],
      context,
    );
    assertAllowedEvidenceUrl(approval.reference, `${context}.reference`);
    const approver = assertNonEmptyString(approval.approver, `${context}.approver`);
    assertNonPlaceholder(approver, `${context}.approver`);
    const approvedOn = assertDate(approval.approvedOn, `${context}.approvedOn`, today);
    return { status: 'approved', reference: approval.reference.trim(), approver, approvedOn };
  }

  throw new Error(`${context}.status must be pending or approved.`);
}

export function validateLedger(ledger, { today = new Date().toISOString().slice(0, 10) } = {}) {
  assertObject(ledger, 'Dependency audit ledger');
  assertExactKeys(ledger, ['schemaVersion', 'records'], ['schemaVersion', 'records'], 'Dependency audit ledger');
  if (ledger.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error(`Dependency audit ledger schemaVersion must be ${LEDGER_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(ledger.records)) {
    throw new Error('Dependency audit ledger records must be an array.');
  }

  const records = [];
  const recordByAdvisory = new Map();
  for (const [index, record] of ledger.records.entries()) {
    const context = `Dependency audit ledger record ${index}`;
    assertObject(record, context);
    assertExactKeys(
      record,
      ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn', 'owner', 'rationale', 'remediation', 'expiresOn', 'approval', 'evidence'],
      ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn'],
      context,
    );

    const advisory = assertAdvisoryId(record.advisory, `${context}.advisory`);
    if (recordByAdvisory.has(advisory)) {
      throw new Error(`Dependency audit ledger advisory ${advisory} is duplicated.`);
    }
    const packageName = assertNonEmptyString(record.package, `${context}.package`);
    if (/\s/.test(packageName)) {
      throw new Error(`${context}.package must not contain whitespace.`);
    }
    const severity = assertSeverity(record.severity, `${context}.severity`);
    const observedVersions = normaliseVersions(record.observedVersions, `${context}.observedVersions`);
    const reviewedOn = assertDate(record.reviewedOn, `${context}.reviewedOn`, today);

    if (record.disposition === 'exception') {
      assertExactKeys(
        record,
        ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn', 'owner', 'rationale', 'remediation', 'expiresOn', 'approval'],
        ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn', 'owner', 'rationale', 'remediation', 'expiresOn', 'approval'],
        context,
      );
      const owner = assertNonEmptyString(record.owner, `${context}.owner`);
      assertNonPlaceholder(owner, `${context}.owner`);
      const rationale = assertNonEmptyString(record.rationale, `${context}.rationale`);
      assertNonPlaceholder(rationale, `${context}.rationale`);
      const remediation = assertNonEmptyString(record.remediation, `${context}.remediation`);
      assertNonPlaceholder(remediation, `${context}.remediation`);
      const expiresOn = assertDate(record.expiresOn, `${context}.expiresOn`, today, { allowFuture: true });
      if (expiresOn < today) {
        throw new Error(`Dependency audit exception ${advisory} expired on ${expiresOn}.`);
      }
      const approval = validateApproval(record.approval, `${context}.approval`, today);
      records.push({
        advisory,
        package: packageName,
        severity,
        observedVersions,
        disposition: 'exception',
        reviewedOn,
        owner,
        rationale,
        remediation,
        expiresOn,
        approval,
      });
    } else if (record.disposition === 'not-affected') {
      assertExactKeys(
        record,
        ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn', 'rationale', 'evidence'],
        ['advisory', 'package', 'severity', 'observedVersions', 'disposition', 'reviewedOn', 'rationale', 'evidence'],
        context,
      );
      const rationale = assertNonEmptyString(record.rationale, `${context}.rationale`);
      assertNonPlaceholder(rationale, `${context}.rationale`);
      if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
        throw new Error(`${context}.evidence must contain concrete evidence.`);
      }
      const evidence = record.evidence.map((item, evidenceIndex) => {
        const evidenceContext = `${context}.evidence[${evidenceIndex}]`;
        const value = assertNonEmptyString(item, evidenceContext);
        assertNonPlaceholder(value, evidenceContext);
        return value;
      });
      records.push({
        advisory,
        package: packageName,
        severity,
        observedVersions,
        disposition: 'not-affected',
        reviewedOn,
        rationale,
        evidence,
      });
    } else {
      throw new Error(`${context}.disposition must be not-affected or exception.`);
    }

    recordByAdvisory.set(advisory, records.at(-1));
  }

  return { records, recordByAdvisory };
}

export function normaliseAuditReport(report) {
  assertObject(report, 'pnpm audit report');
  assertExactKeys(report, ['advisories', 'metadata'], ['advisories', 'metadata'], 'pnpm audit report');
  assertObject(report.advisories, 'pnpm audit report advisories');
  assertObject(report.metadata, 'pnpm audit report metadata');
  assertExactKeys(
    report.metadata,
    ['vulnerabilities', 'dependencies', 'devDependencies', 'optionalDependencies', 'totalDependencies'],
    ['vulnerabilities', 'dependencies', 'devDependencies', 'optionalDependencies', 'totalDependencies'],
    'pnpm audit report metadata',
  );
  assertObject(report.metadata.vulnerabilities, 'pnpm audit report metadata.vulnerabilities');
  assertExactKeys(
    report.metadata.vulnerabilities,
    ['info', 'low', 'moderate', 'high', 'critical'],
    ['info', 'low', 'moderate', 'high', 'critical'],
    'pnpm audit report metadata.vulnerabilities',
  );
  for (const [severity, count] of Object.entries(report.metadata.vulnerabilities)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`pnpm audit report metadata.vulnerabilities.${severity} must be a non-negative integer.`);
    }
  }
  if (report.metadata.vulnerabilities.info > 0) {
    throw new Error('pnpm audit report contains info findings that are outside the required --audit-level=low disposition scope.');
  }
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'totalDependencies']) {
    if (!Number.isInteger(report.metadata[field]) || report.metadata[field] < 0) {
      throw new Error(`pnpm audit report metadata.${field} must be a non-negative integer.`);
    }
  }

  const findings = [];
  const advisoryById = new Map();
  for (const [key, advisory] of Object.entries(report.advisories)) {
    assertObject(advisory, `pnpm audit advisory ${key}`);
    const advisoryId = assertAdvisoryId(advisory.github_advisory_id, `pnpm audit advisory ${key}.github_advisory_id`);
    if (advisoryById.has(advisoryId)) {
      throw new Error(`pnpm audit advisory ${advisoryId} is duplicated.`);
    }
    const packageName = assertNonEmptyString(advisory.module_name, `pnpm audit advisory ${advisoryId}.module_name`);
    const severity = assertSeverity(advisory.severity, `pnpm audit advisory ${advisoryId}.severity`);
    if (!Array.isArray(advisory.findings) || advisory.findings.length === 0) {
      throw new Error(`pnpm audit advisory ${advisoryId}.findings must be a non-empty array.`);
    }

    const observedVersions = [];
    let pathCount = 0;
    for (const [findingIndex, finding] of advisory.findings.entries()) {
      const findingContext = `pnpm audit advisory ${advisoryId}.findings[${findingIndex}]`;
      assertObject(finding, findingContext);
      assertExactKeys(finding, ['version', 'paths', 'dev', 'optional', 'bundled'], ['version', 'paths'], findingContext);
      observedVersions.push(assertVersion(finding.version, `${findingContext}.version`));
      if (!Array.isArray(finding.paths) || finding.paths.length === 0 || finding.paths.some((path) => typeof path !== 'string' || path.trim() === '')) {
        throw new Error(`${findingContext}.paths must be a non-empty array of paths.`);
      }
      for (const field of ['dev', 'optional', 'bundled']) {
        if (Object.prototype.hasOwnProperty.call(finding, field) && typeof finding[field] !== 'boolean') {
          throw new Error(`${findingContext}.${field} must be a boolean when present.`);
        }
      }
      pathCount += finding.paths.length;
    }

    const normalized = {
      advisory: advisoryId,
      package: packageName,
      severity,
      observedVersions: [...new Set(observedVersions)].sort(),
      pathCount,
    };
    findings.push(normalized);
    advisoryById.set(advisoryId, normalized);
  }

  return {
    metadata: report.metadata,
    findings,
    advisoryById,
  };
}

export function evaluateAuditReport(report, ledger, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const audit = normaliseAuditReport(report);
  const ledgerState = validateLedger(ledger, { today });
  const errors = [];

  for (const finding of audit.findings) {
    const record = ledgerState.recordByAdvisory.get(finding.advisory);
    if (!record) {
      errors.push(`Missing disposition for current advisory ${finding.advisory} (${finding.package}@${finding.observedVersions.join(', ')}).`);
      continue;
    }
    if (record.package !== finding.package) {
      errors.push(`Package drift for ${finding.advisory}: ledger has ${record.package}, audit reports ${finding.package}.`);
    }
    if (record.severity !== finding.severity) {
      errors.push(`Severity drift for ${finding.advisory}: ledger has ${record.severity}, audit reports ${finding.severity}.`);
    }
    if (!sameValues(record.observedVersions, finding.observedVersions)) {
      errors.push(`Observed version drift for ${finding.advisory}: ledger has ${record.observedVersions.join(', ')}, audit reports ${finding.observedVersions.join(', ')}.`);
    }
  }

  for (const record of ledgerState.records) {
    if (!audit.advisoryById.has(record.advisory)) {
      errors.push(`Stale ledger entry ${record.advisory}: it is not present in the current pnpm audit report.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const pendingExceptions = ledgerState.records.filter(
    (record) => record.disposition === 'exception' && record.approval.status !== 'approved',
  );
  const warnings = pendingExceptions.map(
    (record) => `Approval pending for ${record.advisory} (${record.package}@${record.observedVersions.join(', ')}); reference: ${record.approval.reference}.`,
  );
  const dispositionCounts = { 'not-affected': 0, exception: 0 };
  const approvalStatusCounts = { pending: 0, approved: 0, 'not-applicable': 0 };
  for (const record of ledgerState.records) {
    dispositionCounts[record.disposition] += 1;
    if (record.disposition === 'exception') {
      approvalStatusCounts[record.approval.status] += 1;
    } else {
      approvalStatusCounts['not-applicable'] += 1;
    }
  }

  return {
    audit,
    ledger: ledgerState,
    pendingExceptions,
    warnings,
    dispositionCounts,
    approvalStatusCounts,
    releaseFailures: pendingExceptions.map(
      (record) => `Release approval missing for ${record.advisory}: exception status is ${record.approval.status}.`,
    ),
  };
}

export function assertReleasePolicy(evaluation, { requireApprovedExceptions = false } = {}) {
  if (requireApprovedExceptions && evaluation.releaseFailures.length > 0) {
    throw new Error([
      'Release dependency audit blocked: every active exception must have approved status.',
      ...evaluation.releaseFailures,
    ].join('\n'));
  }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function buildEvidence({
  report,
  evaluation,
  nodeVersion = process.version,
  pnpmVersion,
  lockfilePath = DEFAULT_LOCKFILE_PATH,
  generatedAt = new Date().toISOString(),
  mode = 'default',
  auditExitCode = null,
}) {
  if (!report || !evaluation?.audit || !Array.isArray(evaluation.audit.findings)) {
    throw new Error('Evidence requires an evaluated audit report.');
  }
  if (typeof pnpmVersion !== 'string' || pnpmVersion.trim() === '') {
    throw new Error('Evidence requires the pnpm version.');
  }
  const findings = evaluation.audit.findings.map((finding) => {
    const record = evaluation.ledger.recordByAdvisory.get(finding.advisory);
    return {
      advisory: finding.advisory,
      package: finding.package,
      severity: finding.severity,
      observedVersions: finding.observedVersions,
      versionCount: finding.observedVersions.length,
      pathCount: finding.pathCount,
      disposition: record.disposition,
      approvalStatus: record.disposition === 'exception' ? record.approval.status : 'not-applicable',
    };
  });
  const packageCount = new Set(findings.map((finding) => finding.package)).size;
  const versionCount = findings.reduce((sum, finding) => sum + finding.versionCount, 0);
  const pathCount = findings.reduce((sum, finding) => sum + finding.pathCount, 0);
  return {
    schemaVersion: 1,
    generatedAt,
    mode,
    nodeVersion,
    pnpmVersion: pnpmVersion.trim(),
    auditCommand: `pnpm ${AUDIT_COMMAND.join(' ')}`,
    auditExitCode,
    auditTotals: {
      vulnerabilities: evaluation.audit.metadata.vulnerabilities,
      dependencies: evaluation.audit.metadata.dependencies,
      devDependencies: evaluation.audit.metadata.devDependencies,
      optionalDependencies: evaluation.audit.metadata.optionalDependencies,
      totalDependencies: evaluation.audit.metadata.totalDependencies,
    },
    counts: {
      advisories: findings.length,
      packages: packageCount,
      observedVersions: versionCount,
      paths: pathCount,
    },
    dispositions: {
      counts: evaluation.dispositionCounts,
      approvalStatusCounts: evaluation.approvalStatusCounts,
      findings,
    },
    lockfile: {
      path: basename(lockfilePath),
      sha256: sha256File(lockfilePath),
    },
  };
}

function pathIsWithin(root, candidate) {
  const child = relative(root, candidate);
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function pathIsWithinOrEqual(root, candidate) {
  return root === candidate || pathIsWithin(root, candidate);
}

export function assertSafeEvidencePath(evidencePath, { runnerTemp = process.env.RUNNER_TEMP, systemTemp = tmpdir() } = {}) {
  if (typeof evidencePath !== 'string' || evidencePath.trim() === '') {
    throw new Error('Evidence path must be a non-empty path.');
  }
  const candidate = resolve(evidencePath);
  const roots = [...new Set([systemTemp, runnerTemp].filter(Boolean).map((root) => resolve(root)))];
  if (!roots.some((root) => pathIsWithin(root, candidate))) {
    throw new Error(`Evidence output must be under a temporary or runner-temp directory: ${candidate}.`);
  }

  const parent = dirname(candidate);
  let realParent;
  try {
    realParent = realpathSync(parent);
  } catch {
    throw new Error(`Evidence output parent directory must already exist: ${parent}.`);
  }
  if (!roots.some((root) => pathIsWithinOrEqual(realpathSync(root), realParent))) {
    throw new Error(`Evidence output parent resolves outside a temporary directory: ${parent}.`);
  }
  try {
    if (lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`Evidence output must not be a symbolic link: ${candidate}.`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  return candidate;
}

export function writeEvidence(evidencePath, evidence, options) {
  const safePath = assertSafeEvidencePath(evidencePath, options);
  writeFileSync(safePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8' });
  return safePath;
}

export function parseArgs(args) {
  const options = { requireApprovedExceptions: false, evidencePath: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--require-approved-exceptions') {
      options.requireApprovedExceptions = true;
    } else if (argument === '--evidence') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--evidence requires a path.');
      }
      options.evidencePath = value;
      index += 1;
    } else if (argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function printHelp() {
  console.log('Usage: node scripts/ci/audit_with_exceptions.mjs [--require-approved-exceptions] [--evidence <temp-path>]');
}

function readJson(path, context) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${context} at ${path}: ${error.message}`);
  }
  return value;
}

export function runPolicy({
  ledgerPath = DEFAULT_LEDGER_PATH,
  lockfilePath = DEFAULT_LOCKFILE_PATH,
  evidencePath = null,
  requireApprovedExceptions = false,
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const ledger = readJson(ledgerPath, 'dependency audit ledger');
  const audit = spawnSync('pnpm', AUDIT_COMMAND, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (audit.error) {
    throw new Error(`Unable to run pnpm audit: ${audit.error.message}`);
  }
  if (audit.signal) {
    throw new Error(`pnpm audit was terminated by ${audit.signal}.`);
  }

  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    const stderr = audit.stderr?.trim();
    throw new Error(`pnpm audit did not return valid JSON (exit ${audit.status ?? 'unknown'}).${stderr ? ` ${stderr}` : ''}`);
  }

  const evaluation = evaluateAuditReport(report, ledger, { today });
  const pnpmVersionResult = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  if (pnpmVersionResult.error || pnpmVersionResult.status !== 0) {
    throw new Error(`Unable to determine pnpm version: ${pnpmVersionResult.error?.message ?? pnpmVersionResult.stderr?.trim() ?? 'unknown error'}`);
  }
  const evidence = buildEvidence({
    report,
    evaluation,
    pnpmVersion: pnpmVersionResult.stdout.trim(),
    lockfilePath,
    mode: requireApprovedExceptions ? 'release' : 'default',
    auditExitCode: audit.status,
  });
  if (evidencePath) {
    writeEvidence(evidencePath, evidence);
  }
  assertReleasePolicy(evaluation, { requireApprovedExceptions });
  return { report, evaluation, evidence, evidencePath };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    const result = runPolicy({
      evidencePath: options.evidencePath,
      requireApprovedExceptions: options.requireApprovedExceptions,
    });
    for (const warning of result.evaluation.warnings) {
      console.warn(`::warning::${warning}`);
    }
    const { counts } = result.evidence;
    console.log(
      `Dependency audit ${options.requireApprovedExceptions ? 'release' : 'default'} policy passed: ${counts.advisories} advisory finding(s), ${counts.packages} package(s), ${counts.paths} path(s).`,
    );
    if (result.evidencePath) {
      console.log(`Dependency audit evidence written to ${result.evidencePath}.`);
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main();
}
