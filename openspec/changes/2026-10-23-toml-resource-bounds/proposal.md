# Patch transitive TOML parser resource consumption

## Scope and choice
On 23 October 2026, the exact dev candidate audit reports GHSA-4qx8-w7c3-pj3p,
GHSA-9j65-hcg3-gc64 and GHSA-9qmh-m7c6-f92p against toml 5.0.0.
Each upstream advisory identifies 5.0.1 as the first patched version:
- https://github.com/BinaryMuse/toml-node/security/advisories/GHSA-4qx8-w7c3-pj3p
- https://github.com/BinaryMuse/toml-node/security/advisories/GHSA-9j65-hcg3-gc64
- https://github.com/BinaryMuse/toml-node/security/advisories/GHSA-9qmh-m7c6-f92p

Use the maintained upstream patch rather than a custom parser or an audit exception.
This preserves the existing API, Node >=20 requirement (repo uses Node 24), MIT
license and dependency count. No new service or cost is introduced. The existing
manifest override already permits this patch; only its resolved lock entry and
consumer reference change. No test/package scripts, audit dispositions, workflows,
release validators or other controls change.

## Acceptance and limits
Verify registry tarball SHA512, frozen install, existing audit policy and wallet
unit suite. Exercise ordinary array-of-tables parsing, 20,000 distinct table arrays,
2,000 dotted segments and oversized decimal/hex integer rejection. These are
bounded parser checks, not production runtime or hardware acceptance. Retain
independent review and normal dev/staged/soak/main gates. Existing pending audit
exceptions remain owner decisions; no new exception is introduced.

Tracking: Wallet #778 and Conxian/conxian-business#1390.
