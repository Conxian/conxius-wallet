import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const installer = readFileSync(resolve(repositoryRoot, 'scripts/ci/install_gitleaks.sh'), 'utf8');
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/secret-scan.yml'), 'utf8');
const config = readFileSync(resolve(repositoryRoot, '.gitleaks.toml'), 'utf8');
const baseline = readFileSync(resolve(repositoryRoot, 'docs/operations/CI_CD_BASELINE.md'), 'utf8');
const removedLicenseSetting = ['GITLEAKS', 'LICENSE'].join('_');

describe('repository-owned Gitleaks policy', () => {
  it('pins the official Linux x64 archive and verifies its hard-coded checksum', () => {
    expect(installer).toMatch(/GITLEAKS_VERSION='8\.30\.1'/);
    expect(installer).toMatch(/gitleaks_\$\{GITLEAKS_VERSION\}_linux_x64\.tar\.gz/);
    expect(installer).toMatch(/GITLEAKS_SHA256='[0-9a-f]{64}'/);
    expect(installer).toContain('https://github.com/gitleaks/gitleaks/releases/download/v');
    expect(installer).toContain('sha256sum "$ARCHIVE_PATH"');
    expect(installer).toContain('install -m 0755');
    expect(installer).toContain('RUNNER_TEMP');
  });

  it('runs a tokenless full-history scan with repository configuration and redaction', () => {
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('scripts/ci/install_gitleaks.sh');
    expect(workflow).toContain('--config .gitleaks.toml');
    expect(workflow).toContain('--gitleaks-ignore-path .gitleaksignore');
    expect(workflow).toContain('--redact=100');
    expect(workflow).toContain('--exit-code 1');
    expect(workflow).not.toContain('gitleaks-action');
    expect(workflow).not.toContain(removedLicenseSetting);
  });

  it('keeps the repository Gitleaks configuration valid without broad exclusions', () => {
    expect(config).toContain('[[allowlists]]');
    expect(config).toContain("paths = ['^$']");
    expect(config).not.toMatch(/paths\s*=\s*\[\s*\]/);
  });

  it('documents the stable default CodeQL aggregate without a commercial scan secret', () => {
    expect(baseline).toContain('- `CodeQL`');
    expect(baseline).not.toContain('CodeQL (JavaScript and TypeScript)');
    expect(baseline).not.toContain(removedLicenseSetting);
  });
});
