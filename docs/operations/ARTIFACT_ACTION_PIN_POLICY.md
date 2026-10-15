# Artifact action pin policy

Workflow behavior tests preserve artifact identity, source-run/SHA binding, ordering, missing-file rejection, dependency approval and recovery confirmation. The workflow pin checker independently rejects mutable refs and requires upload/download artifact commits to be in `scripts/ci/artifact_action_pins.json`.

Named and unnamed YAML steps are checked, including quoted references. Missing, malformed, oversized, or incompatible catalogs fail closed. The checker previously missed the common `- uses:` shorthand; negative tests now cover that route.

The catalog records upstream tag-to-commit values verified on 2026-10-14: upload-artifact v7.0.1/v7.0.2 and download-artifact v8.0.1/v8.0.2. Both current and proposed versions remain accepted so independent upgrades can merge without reverting one another. Unknown commits fail even when formatted as forty hex characters. This catalog is a curated code-source allowlist, not release authorization or dependency-exception approval.

For subsequent upgrades, resolve the exact official upstream tag (including annotated-tag dereferencing), inspect the change, update the catalog in the upgrade PR, and run workflow pin and behavior tests plus hosted CI. Other remote actions retain the existing immutable-ref check and require their own source review. Missing or invalid catalogs fail closed. Do not loosen the checker to make a dependency PR green.
