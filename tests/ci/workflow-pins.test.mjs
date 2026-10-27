import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function runChecker(workflow, catalogOverride = undefined) {
  const root = mkdtempSync(join(tmpdir(), 'conxius-workflow-pins-'));
  temporaryRoots.push(root);
  writeFileSync(join(root, 'workflow.yml'), workflow);
  let checkerPath = checker;
  if (catalogOverride !== undefined) {
    checkerPath = join(root, 'check_workflow_pins.py');
    writeFileSync(checkerPath, readFileSync(checker, 'utf8'));
    if (catalogOverride !== null) writeFileSync(join(root, 'artifact_action_pins.json'), catalogOverride);
  }
  try {
    return { passed: true, output: execFileSync('python3', [checkerPath, root], { encoding: 'utf8' }) };
  } catch (error) {
    return { passed: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

describe('workflow pin validation', () => {
  it.each([
    { name: 'missing', content: null },
    { name: 'malformed', content: '{broken' },
    { name: 'oversized', content: ' '.repeat(8193) },
    { name: 'boolean version', content: JSON.stringify({
      ...JSON.parse(readFileSync(resolve(repositoryRoot, 'scripts/ci/artifact_action_pins.json'), 'utf8')),
      schema_version: true,
    }) },
  ])('rejects a $name artifact catalog', ({ content }) => {
    const result = runChecker('jobs:\n  checkout:\n    uses: actions/checkout@0123456789abcdef0123456789abcdef01234567\n', content);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/artifact action pin catalog unavailable or invalid/);
  });

  it.each(['upload-artifact', 'download-artifact'])('rejects unknown %s pins in unnamed steps', (action) => {
    const result = runChecker(`jobs:\n  build:\n    steps:\n      - uses: actions/${action}@0123456789abcdef0123456789abcdef01234567\n`);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/not in the reviewed upstream pin catalog/);
  });

  it('rejects mutable refs in unnamed steps', () => {
    const result = runChecker('jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v4\n');
    expect(result.passed).toBe(false);
  });

  it('accepts quoted reviewed pins in unnamed steps', () => {
    const result = runChecker('jobs:\n  build:\n    steps:\n      - uses: "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9"\n');
    expect(result.passed).toBe(true);
  });
  it('accepts the current and reviewed upgraded artifact action commits', () => {
    const result = runChecker(`jobs:
  uploads-current:
    uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
  uploads-upgraded:
    uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9
  downloads-current:
    uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c
  downloads-upgraded:
    uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333
`);
    expect(result.passed).toBe(true);
  });

  it.each(['upload-artifact', 'download-artifact'])('rejects an unreviewed immutable %s commit', (action) => {
    const result = runChecker(`jobs:\n  artifact:\n    uses: actions/${action}@0123456789abcdef0123456789abcdef01234567\n`);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/not in the reviewed upstream pin catalog/);
  });
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
