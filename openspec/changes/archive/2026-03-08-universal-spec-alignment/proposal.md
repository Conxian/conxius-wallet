---
title: Proposal
layout: page
permalink: /./openspec/changes/archive/2026-03-08-universal-spec-alignment/proposal
---

# Proposal: Universal Spec and PRD Alignment

## Why
The current project documentation (PRDs, Implementation Registry, Roadmap) has version inconsistencies (v1.9.2 vs v1.9.2) and is scattered across multiple locations. To maintain the "Clean Break" native migration integrity, we need a single source of truth using the OpenSpec framework.

## What's Changing
- **Centralization**: All high-level specifications are being moved to `openspec/specs/`.
- **Version Normalization**: Aligning all documents to the target **v1.9.2 (Citadel Native)**.
- **Spec-Driven Design**: Establishing a clear mapping between business goals, asset support, and module architecture.
- **Remediation**: Updating PRDs to reflect the current "PRODUCTION" status of Babylon, NWC, and DLCs as per the Implementation Registry.
