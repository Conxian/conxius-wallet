import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');

function jobSection(jobId) {
  const match = workflow.match(new RegExp(`\\n  ${jobId}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|$)`));
  expect(match, `missing workflow job: ${jobId}`).not.toBeNull();
  return match[1];
}

describe('CI workflow contracts', () => {
  it('publishes one immutable web-dist artifact from Web Build', () => {
    const webBuild = jobSection('web-build');
    expect(webBuild).toContain('name: Web Build');
    expect(webBuild).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a');
    expect(webBuild).toMatch(/name: web-dist[\s\S]*path: dist/);
    expect(webBuild).toContain('if-no-files-found: error');
  });

  it.each(['android-lint', 'android-unit-tests'])('makes %s consume Web Build assets before sync', (jobId) => {
    const job = jobSection(jobId);
    expect(job).toContain('needs: web-build');
    expect(job).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c');
    expect(job).toMatch(/name: web-dist[\s\S]*path: dist/);
    expect(job.indexOf('Download web assets')).toBeLessThan(job.indexOf('pnpm exec cap sync android'));
  });

  it('derives VERSION_CODE before Android release lint', () => {
    const lintJob = jobSection('android-lint');
    expect(lintJob.indexOf('echo "VERSION_CODE=$VERSION_CODE"')).toBeLessThan(
      lintJob.indexOf('./gradlew :app:lintRelease'),
    );
  });

  it.each(['android-lint', 'android-unit-tests'])('validates the native Cargo contract before %s runs Gradle', (jobId) => {
    const job = jobSection(jobId);
    expect(job).toContain('node scripts/ci/validate_silent_payments_native_build.mjs');
    expect(job.indexOf('Validate silent-payment native build contract')).toBeLessThan(job.indexOf('./gradlew'));
  });
});
