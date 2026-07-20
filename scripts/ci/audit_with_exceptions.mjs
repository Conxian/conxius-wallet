import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const exceptionsPath = resolve(scriptDir, 'dependency-audit-exceptions.json');
const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const allowedSeverities = new Set(['high', 'critical']);

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!Array.isArray(exceptions)) {
  fail(`${exceptionsPath} must contain an array of audit exceptions.`);
}

const exceptionByAdvisory = new Map();
for (const exception of exceptions) {
  if (!exception || typeof exception !== 'object') {
    fail('Each dependency audit exception must be an object.');
  }
  for (const field of ['advisory', 'package', 'severity', 'owner', 'expiresOn', 'rationale', 'remediation']) {
    if (typeof exception[field] !== 'string' || exception[field].trim() === '') {
      fail(`Audit exception ${exception.advisory ?? '<unknown>'} is missing ${field}.`);
    }
  }
  if (!allowedSeverities.has(exception.severity)) {
    fail(`Audit exception ${exception.advisory} has unsupported severity ${exception.severity}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn) || exception.expiresOn < today) {
    fail(`Audit exception ${exception.advisory} expired on ${exception.expiresOn}.`);
  }
  if (exceptionByAdvisory.has(exception.advisory)) {
    fail(`Audit exception ${exception.advisory} is duplicated.`);
  }
  exceptionByAdvisory.set(exception.advisory, exception);
}

const audit = spawnSync('pnpm', ['audit', '--audit-level=high', '--json'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

if (audit.error) {
  fail(`Unable to run pnpm audit: ${audit.error.message}`);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(audit.stderr.trim());
  console.error(audit.stdout.trim());
  fail(`pnpm audit did not return valid JSON (exit ${audit.status ?? 'unknown'}).`);
}

const advisories = Object.values(report.advisories ?? {});
const highOrCritical = advisories.filter((advisory) => allowedSeverities.has(advisory.severity));
const unexpected = highOrCritical.filter((advisory) => {
  const exception = exceptionByAdvisory.get(advisory.github_advisory_id);
  return !exception || exception.package !== advisory.module_name || exception.severity !== advisory.severity;
});

if (unexpected.length > 0) {
  console.error('Unexpected high/critical dependency findings:');
  for (const advisory of unexpected) {
    console.error(`- ${advisory.github_advisory_id ?? '<missing advisory id>'}: ${advisory.module_name} (${advisory.severity})`);
  }
  fail('Dependency audit found a high/critical advisory without a valid, active exception.');
}

const activeExceptionIds = new Set(highOrCritical.map((advisory) => advisory.github_advisory_id));
for (const exception of exceptions) {
  if (!activeExceptionIds.has(exception.advisory)) {
    console.warn(`::warning::Configured audit exception ${exception.advisory} is not currently reported; remove it after confirming remediation.`);
  }
}

const metadata = report.metadata?.vulnerabilities ?? {};
const total = Object.values(metadata).reduce((sum, count) => sum + Number(count || 0), 0);
console.log(`Dependency audit passed high/critical policy: ${highOrCritical.length} active exception(s), ${total} total advisory finding(s).`);
for (const advisory of highOrCritical) {
  const exception = exceptionByAdvisory.get(advisory.github_advisory_id);
  console.log(`- ${advisory.github_advisory_id}: ${advisory.module_name}@${advisory.findings?.[0]?.version ?? 'unknown'} (${advisory.severity}), exception expires ${exception.expiresOn}.`);
}
