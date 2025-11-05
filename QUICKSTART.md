# Quick Start Guide - integra-eas-worker

Get the `integra-eas-worker` running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare account with Workers access
- Access to Integra infrastructure (RabbitMQ, D1 databases)

## Step 1: Install Dependencies

```bash
cd /Users/davidfisher/Integra/AAA-LAUNCH/repos/cloudflare-apps/integra-eas-worker
npm install
```

## Step 2: Configure Environment

### Create local environment file

```bash
cp .env.example .dev.vars
```

### Edit `.dev.vars` with your values

```bash
# .dev.vars
RABBITMQ_URL=amqps://username:password@hostname/vhost
INTERNAL_SIGNING_KEY=your-hmac-key-here
ETHEREUM_SCHEMA_UIDS={"capability":"0xYOUR_ETH_SCHEMA_UID"}
POLYGON_SCHEMA_UIDS={"capability":"0xYOUR_POLYGON_SCHEMA_UID"}
```

## Step 3: Update wrangler.toml

Replace placeholder database IDs:

```toml
[[d1_databases]]
binding = "SHARED_REGISTRY_PROD"
database_name = "shared-registry-prod"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # <-- Update this
```

## Step 4: Run Type Check

```bash
npm run typecheck
```

Expected: `No errors`

## Step 5: Start Local Development

```bash
npm run dev
```

Expected output:
```
⛅️ wrangler 4.41.0
------------------
Your worker has access to the following bindings:
- D1 Databases:
  - SHARED_REGISTRY_PROD: ...
- Durable Objects:
  - ATTESTATION_TRACKER: AttestationTracker
```

## Step 6: Test Health Endpoint

In another terminal:

```bash
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "integra-eas-worker",
  "timestamp": "2025-11-05T..."
}
```

## Step 7: Test tRPC Endpoint

```bash
curl -X POST http://localhost:8787/trpc/getAttestationStatus \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "test-workflow-id"}'
```

Expected: `404` or validation error (normal - just verifying endpoint exists)

## You're Ready!

The worker is now running locally. Next steps:

1. **Add workflow definitions** to shared-registry-prod
2. **Configure authentication** in `src/trpc/context.ts`
3. **Deploy to production** with `npm run deploy`

## Common Issues

### Issue: Database not found

**Fix**: Update database IDs in `wrangler.toml`

### Issue: Type errors

**Fix**: Run `npm install` to ensure all dependencies installed

### Issue: Port already in use

**Fix**: Stop other workers or use `wrangler dev --port 8788`

## Next Steps

- See `README.md` for full documentation
- See `DEPLOYMENT.md` for production deployment guide
- See `IMPLEMENTATION_SUMMARY.md` for architecture details

## Quick Commands

```bash
# Type check
npm run typecheck

# Run locally
npm run dev

# Deploy to production
npm run deploy

# View logs
wrangler tail

# List deployments
wrangler deployments list
```

---

**Ready in**: ~5 minutes
**Status**: Local development ready
**Next**: Production deployment (see DEPLOYMENT.md)
