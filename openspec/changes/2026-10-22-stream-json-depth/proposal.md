# Patch streaming JSON depth denial of service

Owner: Business #1390; Wallet audit/release track #399 and promotion #776.

22 October 2026 primary GitHub advisory GHSA-jj87-hc4r-jwfw identifies
stream-json >=2.0.0 through 3.6.0 as vulnerable to quadratic work in
FlexAssembler string/RegExp path filters. First patched version: 3.7.0.
https://github.com/advisories/GHSA-jj87-hc4r-jwfw
https://github.com/uhop/stream-json/releases/tag/3.7.0

Pin the existing override to 3.7.0 in both manifests and the lockfile. The
upstream release retains stream-chain ^4.2.5, already resolved in this graph.
A compatible maintained upstream patch avoids a custom parser fork and new
maintenance/dependency burden. An audit exception retains vulnerable code.
No new resource commitments, services or policy changes are needed.

Acceptance: frozen installation accepts the final graph; verify registry
integrity, existing audit policy, relevant regression tests and web build.
Hosted native/E2E checks and genuine independent review remain required.
Preserve all workflow, validator, audit exception, script and release controls.
Do not modify immutable #776; integrate reviewed ordinary work into dev and
produce a fresh retained promotion successor. Local dependency tests are not
hardware, custody, runtime or independent release acceptance.
