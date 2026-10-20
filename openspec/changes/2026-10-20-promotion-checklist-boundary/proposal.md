# Restore the explicit feature checklist boundary

Parent: #357; org release controls: Business #1415. Current dev imported the actor/numeric-suffix checklist bypass in #756. Restore the previously tested policy and test baseline from dev 456c255 without reverting the useful Vite/report work or independently owned audit records.

Add negative regressions proving a numeric branch suffix and a caller-supplied Jules-like actor cannot supply a missing feature checklist. Add a positive case proving the same branch/actor with the actual checklist still works. Preserve existing explicit reconciliation/dependency routes and exact immutable promotion head checks. No approval/acceptance auto-fill or security disposition change.

Validate the new negatives fail on actual current dev, then pass after restoration along with the existing promotion tests. Keep runtime/Vite/dependency/audit records byte-identical to current dev. Require genuine independent review and exact-source checks. This repairs the introduced expansion only; historical pre-existing bot routes are outside this bounded change.
