import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/android-release.yml'), 'utf8');
const attestationScript = readFileSync(resolve(repositoryRoot, 'scripts/ci/verify_release_attestation.sh'), 'utf8');
const evidenceScript = readFileSync(resolve(repositoryRoot, 'scripts/ci/finalize_release_evidence.sh'), 'utf8');

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

    const recovery = jobSection('release-recover');
    expect(recovery).toContain("if: inputs.operation == 'recover'");
    expect(recovery).toContain('PLAY_PUBLISHED');
    expect(recovery).toContain('gh run view');
    expect(recovery).toContain("publishStep?.conclusion !== 'success'");
    expect(recovery).toContain('run.headSha !== process.env.SOURCE_SHA');
  });

  it('recovers only from the exact verified artifact and never rebuilds or republishes Play', () => {
    const recovery = jobSection('release-recover');
    expect(recovery).toContain('actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093');
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

  it('keeps provenance and evidence helpers fail-closed and idempotent', () => {
    expect(attestationScript).toContain('--source-digest "$SOURCE_SHA"');
    expect(attestationScript).toContain('every release subject must have a verified provenance attestation');
    expect(evidenceScript).toContain('git ls-remote --exit-code --refs origin');
    expect(evidenceScript).toContain('existing release tag does not point to the verified source commit');
    expect(evidenceScript).toContain('gh release view');
    expect(evidenceScript).toContain('gh release upload');
    expect(evidenceScript).toContain('gh release download');
    expect(evidenceScript).toContain('cmp --');
    expect(evidenceScript).toContain('release tag already exists; use the explicit recover operation');
    expect(evidenceScript).toContain('GitHub Release already exists; use the explicit recover operation');
    expect(evidenceScript).not.toContain('git push --force');
    expect(evidenceScript).not.toContain('--clobber');
  });
});
