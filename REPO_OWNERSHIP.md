# Repo ownership

## Purpose

`conxius-wallet` is a reference client for the Conxian builder platform.

## This repo owns

- reference interaction flows
- example user-facing capabilities
- signer UX validation
- demonstration of supported layer capabilities

## This repo does not own

- canonical adapter implementations
- canonical shared-core behavior
- strategic portfolio center
- infrastructure logic that belongs below the client layer

## Boundary rule

This repo should validate and demonstrate the platform strategy, not define it. Shared logic should move downward into strategic infrastructure repos where appropriate.

## Strategic role

Reference repo.