# Fail closed for unsupported smart-wallet policies

Owner: Wallet #357/#727; Business #1390; source finding #785.

At dev 724fce2f541ee8f20ce14dc7021ca35ff8ebdaf2, active timelock,
threshold, inheritance and social-recovery checks can return true without any
transaction or signature evidence. Funding-script generation hashes the UTF-8
policy expression, without compiling Script or resolving placeholder keys.

BIP 341 (primary source inspected 23 October 2026):
https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Its script-path commitment is over actual script bytes and CompactSize length;
a syntactically shaped P2TR output is not proof of a compiled spending policy.

Select a bounded unsupported result instead of introducing a custom compiler or
an unqualified cryptographic dependency. Preserve exported function signatures,
policy descriptions, inactive-policy behavior and the existing velocity amount
preflight. Reject unsupported active policies, malformed/non-integral/negative
amounts or limits, overflow and uncompiled funding scripts. A successful amount
preflight is explicitly not transaction satisfaction or signing authorization.
No non-test callers of these two helpers were found in the current repository.

Acceptance: negative regressions must fail against the previous source; focused
and full unit suites and applicable type/lint checks pass. Preserve workflows,
release validators, package/test scripts, dependency pins and existing controls
byte-for-byte. A reviewed compiler, concrete key binding, transaction-aware
satisfier and independent spend vectors remain future work under the same owner.
Do not amend immutable promotion heads; integrate reviewed ordinary work then
regenerate successors through dev/staged/real soak/main and release acceptance.
