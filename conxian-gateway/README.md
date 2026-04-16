---
title: Readme
layout: page
permalink: /./conxian-gateway/README
---

# Conxian Gateway: Unified Backend Services

This directory consolidates all backend needs and requirements for the Conxius ecosystem.
It is designed to run either locally (via Docker Compose) or on GCP (via Cloud Run / GCE).

## Services Included

1. **Changelly Proxy**: Proxies requests to Changelly to keep secrets off mobile devices.
2. **Bisq Node**: Runs a headless Bisq daemon with gRPC API enabled.
3. **Infrastructure Config**: GCP deployment scripts and documentation.

## Running Locally (Profiles)

You can enable optional "Add-on Packs" using Docker profiles.

```bash
# Core only (Changelly Proxy)
docker-compose up -d

# Enable Bisq
docker-compose --profile bisq up -d

# Enable All (Bisq, RGB, BitVM)
docker-compose --profile bisq --profile rgb --profile bitvm up -d
```

### Environment Variables

Ensure these are set in your `.env` file:
- `CHANGELLY_API_KEY`
- `CHANGELLY_API_SECRET`
- `BISQ_API_PASSWORD` (Required if Bisq profile is enabled)



1. Create a `.env` file with your API keys:
   ```
   CHANGELLY_API_KEY=replace_with_key
   CHANGELLY_API_SECRET=replace_with_secret
   BISQ_API_PASSWORD=replace_with_password
   ```
2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

## Running on GCP

Refer to [GCP_GUIDE.md](./GCP_GUIDE.md) for deployment instructions for each service.

## Integration

The mobile app should point its VITE_ env variables to this gateway (localhost for dev, GCP URL for prod).
