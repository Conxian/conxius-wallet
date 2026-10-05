import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scannerPath = resolve(repositoryRoot, 'scripts/ci/baseline_hygiene_scanner.py');

describe('baseline hygiene scanner', () => {
  it('executes successfully and passes all repository baseline hygiene checks', () => {
    const output = execFileSync('python3', [scannerPath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('Starting Conxian Baseline Hygiene Scanner...');
    expect(output).toContain('No tracked sensitive files found in git history.');
    expect(output).toContain('No tracked generated artifacts or build files in git.');
    expect(output).toContain('.gitignore contains no duplicate rules.');
    expect(output).toContain('All versions are perfectly synchronized at');
    expect(output).toContain('ALL BASELINE HYGIENE CHECKS PASSED SUCCESSFULLY!');
  });
});
