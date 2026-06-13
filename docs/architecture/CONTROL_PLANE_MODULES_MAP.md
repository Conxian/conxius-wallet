---
title: Control-Plane Modules Map
layout: page
permalink: /docs/control-plane-map
---

# Control-Plane Modules Map (v1.0)

**Date:** 2026-06-13
**Status:** DRAFT / ALIGNING
**Issue:** CON-773

## 1. Overview

This document maps the implementation of the first internal control-plane modules for the Conxian ecosystem. These modules reside in the private ops surface and provide governance, audit, and registry capabilities.

## 2. Module Registry

| Module | Purpose | Dependency | Status |
| :--- | :--- | :--- | :--- |
| **Release Governance** | Internal coordination of versioned releases across repos. | `conxian-nexus` | PLANNED |
| **Audit Dashboard** | Event visibility and security logging for internal ops. | `lib-conxian-core` | PLANNED |
| **Policy Approval Queue** | Internal change control for sensitive protocol updates. | `conxian-gateway` | PLANNED |
| **Environment Registry** | Config registry for private operational use. | `conxius-platform` | PLANNED |

## 3. Boundary Rules

1. **Non-Custodial**: Control-plane modules MUST NOT own or manage user private keys.
2. **Open-Core Consistency**: Modules should enhance the open-core ecosystem without redefining it as a closed platform.
3. **Private Ops Only**: These modules are reserved for internal operational use and are not part of the public product surface.

## 4. Initial UI Route Map (Conceptual)

- `/admin/releases`: Release governance dashboard.
- `/admin/audit`: Centralized audit log viewer.
- `/admin/policies`: Pending policy approval queue.
- `/admin/registry`: Environment and configuration registry.

---
*Verified by Sovereign Architect Agent.*
