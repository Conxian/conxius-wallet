import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/android-release.yml'), 'utf8');
const attestationScript = readFileSync(resolve(repositoryRoot, 'scripts/ci/verify_release_attestation.sh'), 'utf8');
const evidenceScript = readFileSync(resolve(repositoryRoot, 'scripts/ci/finalize_release_evidence.sh'), 'utf8');
const retryValidationScript = resolve(repositoryRoot, 'scripts/ci/validate_release_retry_request.sh');

function jobSection(jobId) {
  const match = workflow.match(new RegExp(`\\n  ${jobId}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|$)`));
  expect(match, `missing workflow job: ${jobId}`).not.toBeNull();
  return match[1];
}

describe('Android release workflow policy', () => {
  it('installs the compile SDK used by every Android release module', () => {
    const verification = jobSection('release-verify');
    expect(verification).toContain('platforms;android-36');
    expect(verification).not.toContain('platforms;android-35');
  });

  it('requires approved dependency exceptions and uploads release evidence before the gate', () => {
    const verification = jobSection('release-verify');
    expect(verification).toContain('continue-on-error: true');
    expect(verification).toContain('--require-approved-exceptions');
    expect(verification).toContain('--evidence "$RUNNER_TEMP/conxius-dependency-audit-release.json"');
    expect(verification).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a');
    expect(verification).toContain('path: ${{ runner.temp }}/conxius-dependency-audit-release.json');
    expect(verification).toContain("if: steps.dependency-audit.outcome == 'failure'");
    expect(verification.indexOf('Dependency audit policy')).toBeLessThan(verification.indexOf('Upload dependency audit release evidence'));
    expect(verification.indexOf('Upload dependency audit release evidence')).toBeLessThan(verification.indexOf('Enforce release dependency audit gate'));
  });

  it('creates and verifies immutable release evidence before Play publication', () => {
    const publish = jobSection('release-publish');
    expect(publish).toContain('finalize_release_evidence.sh');
    expect(publish).not.toContain('action-gh-release');
    expect(publish.indexOf('Finalize immutable release evidence before publication')).toBeLessThan(
      publish.indexOf('Publish exact AAB to Google Play production track'),
    );
    expect(publish).toContain('r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5');
  });

  it('requires an explicit recovery request tied to a successful source run', () => {
    expect(workflow).toContain('operation:');
    expect(workflow).toContain('source_run_id:');
    expect(workflow).toContain('source_sha:');
    expect(workflow).toContain('recovery_confirmation:');
    expect(workflow).toContain('retry_confirmation:');

    const recovery = jobSection('release-recover');
    expect(recovery).toContain("if: inputs.operation == 'recover'");
    expect(recovery).toContain('PLAY_PUBLISHED');
    expect(recovery).toContain('gh run view');
    expect(recovery).toContain("publishStep?.conclusion !== 'success'");
    expect(recovery).toContain('run.headSha !== process.env.SOURCE_SHA');
  });

  it('recovers only from the exact verified artifact and never rebuilds or republishes Play', () => {
    const recovery = jobSection('release-recover');
    expect(recovery).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c');
    expect(recovery).toContain('run-id: ${{ inputs.source_run_id }}');
    expect(recovery).toContain('verify_release_attestation.sh');
    expect(recovery).toContain('verify_release_payload.sh');
    expect(recovery).toContain('finalize_release_evidence.sh');
    expect(recovery).not.toContain('upload-google-play');
    expect(recovery).not.toContain('pnpm install');
    expect(recovery).not.toContain('./gradlew');
    expect(recovery).not.toContain('bundleRelease');
    expect(recovery).not.toContain('assembleRelease');
    expect(recovery).not.toContain('cap sync android');
  });

  it('provides a confirmed retry path for evidence-complete Play failures', () => {
    const retry = jobSection('release-retry');
    expect(retry).toContain("if: inputs.operation == 'retry'");
    expect(retry).toContain('environment: production');
    expect(retry).toContain('validate_release_retry_request.sh');
    expect(workflow).toContain('PLAY_NOT_PUBLISHED_<versionCode>');
    expect(retry).toContain('gh run view');
    expect(retry).toContain("evidenceStep?.conclusion !== 'success'");
    expect(retry).toContain("publishStep.conclusion === 'success'");
    expect(retry).toContain('actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c');
    expect(retry).toContain('run-id: ${{ inputs.source_run_id }}');
    expect(retry).toContain('verify_release_attestation.sh');
    expect(retry).toContain('verify_release_payload.sh');
    expect(retry).toContain('finalize_release_evidence.sh');
    expect(retry).toContain('retry');
    expect(retry).toContain('r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5');
    expect(retry.indexOf('Verify existing immutable release evidence before retry publication')).toBeLessThan(
      retry.indexOf('Retry exact AAB to Google Play production track'),
    );
    expect(retry).not.toContain('pnpm install');
    expect(retry).not.toContain('./gradlew');
    expect(retry).not.toContain('bundleRelease');
    expect(retry).not.toContain('assembleRelease');
    expect(retry).not.toContain('cap sync android');
  });

  it('rejects missing, generic, or unsafe retry confirmations', () => {
    const sourceSha = 'a'.repeat(40);
    const runRetryValidation = (confirmation, runId = '123', sha = sourceSha, versionCode = '10905') =>
      () => execFileSync('bash', [retryValidationScript, runId, sha, versionCode, confirmation], { stdio: 'ignore' });

    expect(runRetryValidation('PLAY_NOT_PUBLISHED_10905')).not.toThrow();
    expect(runRetryValidation('')).toThrow();
    expect(runRetryValidation('PLAY_NOT_PUBLISHED')).toThrow();
    expect(runRetryValidation('PLAY_PUBLISHED')).toThrow();
    expect(runRetryValidation('PLAY_NOT_PUBLISHED_10905', '0')).toThrow();
    expect(runRetryValidation('PLAY_NOT_PUBLISHED_10905', '123', 'not-a-sha')).toThrow();
  });

  it('keeps provenance and evidence helpers fail-closed and idempotent', () => {
    expect(attestationScript).toContain('--source-digest "$SOURCE_SHA"');
    expect(attestationScript).toContain('every release subject must have a verified provenance attestation');
    expect(evidenceScript).toContain('git ls-remote --exit-code --refs origin');
    expect(evidenceScript).toContain('existing release tag does not point to the verified source commit');
    expect(evidenceScript).toContain('gh release view');
    expect(evidenceScript).toContain('gh release upload');
    expect(evidenceScript).toContain('gh release download');
    expect(evidenceScript).toContain('cmp --');
    expect(evidenceScript).toContain('release tag already exists; use the explicit retry or recover operation');
    expect(evidenceScript).toContain('GitHub Release already exists; use the explicit retry or recover operation');
    expect(evidenceScript).toContain('retry requires every immutable GitHub Release asset to already exist');
    expect(evidenceScript).not.toContain('git push --force');
    expect(evidenceScript).not.toContain('--clobber');
  });
});
