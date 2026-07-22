---
title: Conxius Wallet: GCP Infrastructure Guide
layout: page
permalink: /docs/gcp-infrastructure
---

# Conxius Wallet: GCP Infrastructure Guide

This document maps the Conxius "No Mock" production requirements to Google Cloud Platform (GCP) services.

**Deployment project:** The project is environment configuration, not a universal product constant. The current proxy workflow uses `gen-lang-client-0264096458`; Play Integrity must use the Google Cloud project number linked to the released Play application.

---

## 🏗️ Architecture Overview

| Component | GCP Service | Rationale | Cost Tier |
|-----------|-------------|-----------|-----------|
| **Changelly Proxy** | **Cloud Run** | Stateless, scales to zero, HTTPS out-of-the-box. | Free Tier eligible (if low traffic) |
| **Bisq Node** | **Compute Engine (e2-medium)** | Stateful (Tor, Wallet, P2P), needs persistent disk. | ~$25-30/mo |
| **Secrets** | **Secret Manager** | Secure storage for service/API credentials only; never wallet seed phrases, mnemonics, private keys, or signing material. | Pay-per-access |
| **Static Configs** | **Cloud Storage** | Hosting Liquid federation scripts/metadata. | Cents/mo |
| **Play Integrity** | **API & Services** | Backend decryption and verdict verification for the client-acquired opaque token; quota and billing are subject to the configured Google Cloud/Play Integrity account. | Configuration-dependent |

---

## 1. Changelly Proxy (Cloud Run)

**Role:** Hides `CHANGELLY_API_SECRET` from the mobile app. Proxies JSON-RPC requests.

### Deployment Steps

1. **Enable APIs:** `run.googleapis.com`, `artifactregistry.googleapis.com`
2. **Build Container:**

   ```bash
   gcloud builds submit --tag gcr.io/gen-lang-client-0264096458/changelly-proxy ./conxian-gateway/changelly-proxy
   ```

3. **Deploy:**

   ```bash
   gcloud run deploy changelly-proxy \
     --image gcr.io/gen-lang-client-0264096458/changelly-proxy \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars CHANGELLY_API_KEY=...,CHANGELLY_API_SECRET=...
   ```

4. **Output:** Set `VITE_CHANGELLY_PROXY_URL` in Android app to the Cloud Run URL.

---

## 2. Bisq Node (Compute Engine)

**Role:** Runs `bisq-daemon` connected to Tor network. Exposes gRPC over a secure tunnel (or via a sidecar proxy).

### Deployment Steps

1. **Create VM:**

   ```bash
   gcloud compute instances create bisq-node-01 \
     --machine-type=e2-medium \
     --image-family=debian-11 \
     --image-project=debian-cloud \
     --boot-disk-size=50GB \
     --metadata-from-file startup-script=./conxian-gateway/bisq/startup-script.sh
   ```

2. **Security:**
   - Firewall: Allow ingress only from Cloud Run (if using proxy) or VPN.
   - **Recommended:** Do NOT expose Bisq gRPC port (9998) publicly. Use an SSH tunnel or a Cloud Run sidecar with mTLS.

---

## 3. Play Integrity API (Security)

**Role:** The app acquires an opaque Play Integrity token. Backend decryption, verdict and request-hash verification, freshness/replay policy, and value-operation enforcement remain required and pending; the client does not verify device integrity.

The wallet-side boundary and qualification matrix are maintained in the
[CON-1544 report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md). Use
the official [Standard request guidance](https://developer.android.com/google/play/integrity/standard)
and [verdict validation guidance](https://developer.android.com/google/play/integrity/verdicts)
for the server flow.

1. Go to **APIs & Services > Library**.
2. Search for **"Play Integrity API"**.
3. Click **Enable**.
4. Link your Google Play Console app to this GCP project.

---

## 4. Secrets Management

Store the following in **Secret Manager**:

- `changelly-api-secret`
- `bisq-wallet-password` (if automated)
- `marketplace-api-keys`

Never place wallet seed phrases, mnemonics, private keys, authorization private
keys, or protocol signing material in GCP Secret Manager. The wallet remains
local-first and non-custodial; server-side secrets are limited to service/API
credentials required by the deployment.

---

## 5. Cost Estimate (Monthly)

- **Cloud Run:** ~$0 (free tier covers 2M requests)
- **Compute Engine (e2-medium):** ~$25.00
- **Persistent Disk (50GB):** ~$2.00
- **Network Egress:** Variable (usually <$5 for wallet traffic)
- **Total:** ~**$32.00 / month**

---

## 6. CI/CD Pipeline Setup (GitHub Actions)

We use GitHub Actions to automatically build and deploy the Changelly Proxy to Cloud Run.

### Required Secrets

You must set the following secrets in the repository that owns the deployment
workflow (`Conxian/conxius-wallet` for `.github/workflows/deploy-proxy.yml`).

| Secret Name | Description |
|-------------|-------------|
| `GCP_CREDENTIALS` | The JSON key of a Service Account with `Cloud Run Admin`, `Storage Admin`, and `Service Account User` roles. |
| `CHANGELLY_API_KEY` | Your Public Key from Changelly. |
| `CHANGELLY_API_SECRET` | Your Private Key from Changelly. |

### Setup Commands (using `gh` CLI)

Run these commands in your terminal to securely set the secrets:

```bash
# 1. Set GCP Credentials (paste the JSON content when prompted)
gh secret set GCP_CREDENTIALS -R Conxian/conxius-wallet

# 2. Set Changelly Keys
gh secret set CHANGELLY_API_KEY -b "your_actual_api_key" -R Conxian/conxius-wallet
gh secret set CHANGELLY_API_SECRET -b "your_actual_api_secret" -R Conxian/conxius-wallet
```

> **Note:** You can generate your Changelly keys here: [Changelly Developer Portal](https://docs.changelly.com/development/generate-keys)

---

## ⚠️ Critical Security Notes

1. **Bisq Wallet:** The daemon on GCE will hold a hot wallet. **Do not store large amounts.**
2. **Proxy Auth:** The Changelly proxy must verify `App Check` tokens or a shared secret from the Android app to prevent abuse by others.
