# Prevent stale reuse of zero-lifetime HTTP cache entries

Parent: #357; affected checks #757/#754. The linked original audit failed on expired exceptions. Dev advanced externally through #756, including exception-date changes. Preserve the fresh source and actual security dispositions without granting approval; implement one bounded dependency correction separately from those changes.

Patch locked http-cache-semantics 4.2.0 through pnpm's standard patchedDependencies mechanism. Refuse stale reuse when the policy has a non-positive freshness lifetime, including security-zeroed/private/no-store/no-cache responses. This conservatively requires revalidation even for an explicit max-age=0 response. Retain ordinary positive-lifetime stale reuse, fresh explicitly public cache behavior and cache identity rejection. Keep package identity, advisory visibility and all other resolved package versions unchanged. Registry availability alone cannot qualify a dependency fix; separate source/research evidence remains restricted.

The public advisory is https://github.com/advisories/GHSA-ch52-4w7c-c8xp. Current pnpm patch/patch-commit documentation defines patch registration; preserve frozen installation and fail on patch application errors. No package rename, audit skip, expiry extension, approval grant or disposition rewrite is part of this change.

Validate the actual installed transitive package with negative and positive regression tests, existing audit-policy tests, the frozen lock and consumer build/tests. Retain actual audit/approval status: this addresses one dependency behavior, not the complete audit or production/release acceptance. Require genuine independent review and candidate-specific security disposition before integration/release claims.
