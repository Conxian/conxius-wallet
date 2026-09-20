import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const EXPECTED_NODE_MAJOR = '22';

export function getExpectedPnpmVersion(rootDir = DEFAULT_REPOSITORY_ROOT) {
  try {
    const pkgPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.packageManager && pkg.packageManager.startsWith('pnpm@')) {
      return pkg.packageManager.split('@')[1];
    }
  } catch (_err) {
    // Fallback if package.json cannot be read or parsed
  }
  return '11.13.0';
}

export function detectPnpmVersion(env = process.env) {
  const userAgent = env.npm_config_user_agent || '';
  const match = userAgent.match(/pnpm\/([0-9.]+)/);
  if (match) {
    return match[1];
  }

  if (env.PNPM_VERSION) {
    return env.PNPM_VERSION;
  }

  try {
    const stdout = execSync('pnpm -v', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return stdout.trim();
  } catch (_err) {
    try {
      const stdout = execSync('corepack pnpm -v', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return stdout.trim();
    } catch (_err2) {
      return null;
    }
  }
}

export function validateToolchainVersion(options = {}) {
  const rootDir = options.rootDir || DEFAULT_REPOSITORY_ROOT;
  const env = options.env || process.env;
  const nodeVersion = options.nodeVersion || process.version;
  const expectedPnpm = options.expectedPnpm || getExpectedPnpmVersion(rootDir);
  const actualPnpm = options.actualPnpm !== undefined ? options.actualPnpm : detectPnpmVersion(env);

  const errors = [];

  const nodeClean = nodeVersion.replace(/^v/, '');
  const nodeMajor = nodeClean.split('.')[0];
  if (nodeMajor !== EXPECTED_NODE_MAJOR) {
    errors.push(`Node.js version mismatch: expected ${EXPECTED_NODE_MAJOR}.x, got ${nodeVersion}`);
  }

  if (actualPnpm === null) {
    errors.push(`pnpm version check failed: unable to detect pnpm version`);
  } else if (actualPnpm !== expectedPnpm) {
    errors.push(`pnpm version mismatch: expected ${expectedPnpm}, got ${actualPnpm}`);
  }

  return {
    nodeVersion,
    nodeMajor,
    expectedPnpm,
    actualPnpm,
    errors,
  };
}

export function runToolchainVersionCheck(options = {}) {
  const result = validateToolchainVersion(options);
  if (result.errors.length > 0) {
    const message = [
      '::error::Strict Toolchain Version Check Failed:',
      ...result.errors.map((err) => `  - ${err}`),
      'Action: Ensure you are using Node.js 22.x and pnpm 11.13.0 (e.g. corepack enable && corepack install pnpm@11.13.0).',
    ].join('\n');
    throw new Error(message);
  }
  return `Toolchain version check passed: Node ${result.nodeVersion} (major ${result.nodeMajor}), pnpm ${result.actualPnpm}`;
}

function main() {
  try {
    console.log(runToolchainVersionCheck());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
