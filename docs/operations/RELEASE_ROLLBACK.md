# Conxius Wallet Release Rollback

**Scope:** Android Google Play releases and the corresponding GitHub release
artifacts.

Rollback is an incident response action, not a new build shortcut. Preserve
evidence first, use the smallest corrective action that stops user harm, and
never overwrite an already-published version code or tag.

## 1. Declare and contain the incident

1. Open an incident record and record the affected version, version code, tag,
   source commit, workflow run, and the reporter's UTC timestamp.
2. Freeze further production publication. Do not rerun the production publish
   job with a bypass or a different artifact.
3. Identify whether the issue affects signing, private-key handling, backup
   policy, a crash/availability path, a privacy boundary, or only a non-critical
   feature. Escalate suspected key compromise as a security incident.
4. Preserve the release artifact directory, `SHA256SUMS`, SBOM, signature
   reports, attestation URL/ID, workflow logs, and approval evidence in the
   incident record. Do not paste secrets or service-account material into the
   record.

## 2. Halt a Google Play staged rollout

For a release still in staged rollout:

1. An authorized Play Console release owner opens the affected application and
   the active production release.
2. Use the rollout control to **Halt** or pause the rollout. Confirm the halted
   state and capture a screenshot or export showing the version code and rollout
   percentage.
3. Record whether existing installs continue running the affected build and
   whether Play Console offers a rollback/reversal option for that release.
4. If the problem is security-critical, publish an incident communication and
   stop directing users to the affected APK or GitHub release asset. Do not
   delete evidence before the security lead approves retention.

The exact Play Console labels can change. The release owner must verify the
resulting state in the console rather than relying on a successful API response.

## 3. Choose last-known-good or corrective patch

1. **Last-known-good path:** identify the last version code whose checks,
   signature, attestation, and operational evidence are intact. Confirm with
   the lead engineer and security lead that returning users to that state does
   not reintroduce a fixed vulnerability.
2. **Corrective patch path:** create a new patch version and strictly higher
   Android `versionCode`. Re-run the complete verification workflow; never
   rebuild during publication and never reuse the affected version code.
3. Treat an APK from a local workstation, an unverified rerun, or an artifact
   with a changed checksum as ineligible for production.
4. If signing or private-key integrity is uncertain, stop publication and rotate
   or replace the affected credentials under the organization's key-management
   procedure before building a corrective release.

## 4. Handle GitHub tag and release state

1. Keep the original tag, release metadata, checksums, SBOM, and attestation
   available for audit. Mark the GitHub release as withdrawn or add a clear
   incident notice if the release UI permits it.
2. Do not force-move, delete, or recreate a published tag to point at a
   different commit. A corrective release must use a new version and tag.
3. If the GitHub release was created but Play publication failed, record the
   partial state. If the exact versionCode is confirmed absent and not pending
   in Play Console, the approved `retry` operation in
   `.github/workflows/android-release.yml` may republish only the verified AAB
   from the source run, using the required version-bound confirmation. If Play
   state is ambiguous or the versionCode is present, do not retry; withdraw or
   otherwise contain the release according to the incident decision. Never
   silently rerun only the final upload step with an unreviewed artifact.
4. Link the corrective release to the incident and include its source commit,
   artifact checksums, SBOM, signature evidence, and provenance attestation.

## 5. Approval ownership and communication

1. The COO owns operational release/rollback approval under the repository
   operating model. The lead engineer owns technical remediation, and the
   security lead owns security-impact assessment and credential decisions.
2. Record the decision, approvers, timestamps, affected version codes, and the
   selected rollback or corrective-patch path.
3. Notify affected internal operators first, then users and partners through the
   approved incident channel. State what users should do, which versions are
   affected, whether funds/keys are at risk, and where the next verified update
   will appear.
4. Do not disclose private keys, mnemonics, signing passwords, service-account
   JSON, or sensitive incident data in public release notes.

## 6. Verify recovery

Before closing the incident:

1. Confirm Play Console shows the intended rollout state and version code.
2. Install the corrective or last-known-good build from the approved channel and
   verify signature, checksum, startup, lock/unlock, backup policy, and the
   affected user flow on representative devices.
3. Confirm the GitHub release assets match `SHA256SUMS`, the SBOM is present, and
   the provenance attestation refers to the published payload digests.
4. Monitor crash, integrity, support, and transaction signals for the agreed
   observation window.
5. Update the incident record with evidence and a root-cause/prevention action.
   Add a regression test or CI/release control before declaring the rollback
   complete.
