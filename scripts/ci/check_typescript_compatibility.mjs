import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_TOOLCHAIN,
  runToolchainGuard,
  validateToolchain,
} from './check_typescript_toolchain.mjs';

// Backward-compatible entry point for callers of the TypeScript 6 bridge guard.
// The dual-toolchain guard is now authoritative for both compatibility and
// TypeScript 7 promotion checks.
export const APPROVED_TYPESCRIPT_VERSION = EXPECTED_TOOLCHAIN.ts6ReportedVersion;
export const APPROVED_TYPESCRIPT_MAJOR = 6;
export const MIGRATION_ISSUE = '#396';

export function validateTypeScriptCompatibility({
  packageJson,
  lockfile,
  compilerVersions,
  installedTypeScriptVersion,
}) {
  return validateToolchain({
    packageJson,
    lockfile,
    compilerVersions: compilerVersions ?? {
      ts6: installedTypeScriptVersion,
      ts7: EXPECTED_TOOLCHAIN.ts7ReportedVersion,
    },
  });
}

export function runTypeScriptCompatibilityCheck(repositoryRoot) {
  const { compilerVersions, errors } = runToolchainGuard(repositoryRoot);
  if (errors.length > 0) {
    const message = [
      'TypeScript compatibility check failed:',
      ...errors.map((error) => `- ${error}`),
      `Action: keep the TypeScript 6 API lane at package ${EXPECTED_TOOLCHAIN.typescriptVersion} (reported ${EXPECTED_TOOLCHAIN.ts6ReportedVersion}) and validate TypeScript 7 only through the separately guarded lane for ${MIGRATION_ISSUE}.`,
      'Scope: this compatibility alias delegates to the repository-owned dual-toolchain contract.',
    ].join('\n');
    throw new Error(message);
  }

  return `TypeScript compatibility check passed: tsc6 ${compilerVersions.ts6}, tsc ${compilerVersions.ts7}`;
}

function main() {
  const repositoryRoot = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../..');

  try {
    console.log(runTypeScriptCompatibilityCheck(repositoryRoot));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
