import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const checker = resolve(repositoryRoot, 'scripts/ci/check_workflow_pins.py');
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function runChecker(workflow) {
  const root = mkdtempSync(join(tmpdir(), 'conxius-workflow-pins-'));
  temporaryRoots.push(root);
  writeFileSync(join(root, 'workflow.yml'), workflow);
  try {
    return { passed: true, output: execFileSync('python3', [checker, root], { encoding: 'utf8' }) };
  } catch (error) {
    return { passed: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

describe('workflow pin validation', () => {
  it('accepts repository-local actions and reusable workflows', () => {
    const result = runChecker(`
jobs:
  local-action:
    uses: ./.github/actions/security
  local-workflow:
    uses: ./.github/workflows/reusable.yml
  remote:
    uses: actions/checkout@0123456789abcdef0123456789abcdef01234567
`);

    expect(result.passed).toBe(true);
  });

  it('rejects mutable remote refs', () => {
    const result = runChecker('jobs:\n  build:\n    uses: actions/checkout@v4\n');

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/verified 40-character commit SHA/);
  });

  it('rejects ambiguous local references that omit ./', () => {
    const result = runChecker('jobs:\n  build:\n    uses: .github/workflows/reusable.yml\n');

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/must use the \.\/\.\.\. form/);
  });

  it('rejects local references that escape the repository or add a mutable ref', () => {
    const result = runChecker(`jobs:
  traversal:
    uses: ./../outside
  mutable:
    uses: ./.github/actions/security@main
`);

    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/must stay within the repository/);
  });
});
