# Conxian Gateway: Unified Backend Services

This directory consolidates all backend needs and requirements for the Conxius ecosystem.
It is designed to run either locally (via Docker Compose) or on GCP (via Cloud Run / GCE).

## Services Included

1. **Changelly Proxy**: Proxies requests to Changelly to keep secrets off mobile devices.
2. **Bisq Node**: Runs a headless Bisq daemon with gRPC API enabled.
3. **Infrastructure Config**: GCP deployment scripts and documentation.

## Running Locally

1. Create a `.env` file with your API keys:
   ```
   CHANGELLY_API_KEY=your_key
   CHANGELLY_API_SECRET=your_secret
   BISQ_API_PASSWORD=your_password
   ```
2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

## Running on GCP

Refer to [GCP_GUIDE.md](./GCP_GUIDE.md) for deployment instructions for each service.

## Integration

The mobile app should point its VITE_ env variables to this gateway (localhost for dev, GCP URL for prod).
