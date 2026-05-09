# Reference client cleanup migration note

## Status

Planned cleanup in progress

## Why this note exists

`conxius-wallet` is being aligned to the approved builder-platform architecture as the primary reference client.

Under that architecture:
- this repo owns reference interaction flows, signer UX validation, and capability demonstration
- canonical gateway and shared-core ownership should remain below the client layer

Embedded lower-layer overlap currently exists here and is scheduled for reduction.

## What to expect

Upcoming cleanup work will:
- reduce embedded overlap with lower-layer strategic repos
- narrow docs and ownership to reference-client concerns
- keep the wallet focused on example client behavior rather than hidden infrastructure ownership

## Working rule during migration

When editing this repo:
- prefer reference-client behavior and wallet UX concerns
- avoid introducing new hidden lower-layer ownership
- assume shared core and canonical gateway logic should remain outside this repo

## Reference

See the current wallet overlap reduction plan maintained in the portfolio architecture docs for the approved cleanup direction.
