# Deployment Guide - integra-eas-worker

## Pre-Deployment Checklist

### 1. Database Setup

#### Create `attestations` table in all user org databases

Run the following migration on each `ORG_DB_*` database:

```bash
# For each org database
wrangler d1 execute ORG_DB_001 --file=./migrations/001_create_attestations_table.sql
wrangler d1 execute ORG_DB_002 --file=./migrations/001_create_attestations_table.sql
# ... repeat for all org databases
```

Or apply directly:

```bash
wrangler d1 execute ORG_DB_001 --command "$(cat migrations/001_create_attestations_table.sql)"
```

#### Verify table creation

```bash
wrangler d1 execute ORG_DB_001 --command "PRAGMA table_info(attestations);"
```

### 2. Workflow Definitions

Add these workflows to `shared-registry-prod.workflow_library`:

1. **create-capability-attestation** (v2.0.0)
2. **revoke-capability-attestation** (v2.0.0)
3. **batch-create-attestations** (v2.0.0)

See `/v6-registration-resolver-eas/INTEGRA-EAS-WORKER-FINAL.md` for workflow JSON specifications.

### 3. RabbitMQ Queues

Ensure these queues exist in CloudAMQP:

- `ethereum.eas` - For Ethereum attestations
- `polygon.eas` - For Polygon attestations

Queue properties:
- Durable: `true`
- Auto-delete: `false`
- Message TTL: `300000` ms (5 minutes)
- Max Priority: `10`
- Dead Letter Exchange: `workflow.dlq`

### 4. Update wrangler.toml

#### Set database IDs

```toml
[[d1_databases]]
binding = "SHARED_REGISTRY_PROD"
database_name = "shared-registry-prod"
database_id = "YOUR_ACTUAL_DATABASE_ID"

[[d1_databases]]
binding = "ORG_DB_001"
database_name = "org-db-001"
database_id = "YOUR_ORG_DB_001_ID"

# Add all org databases...
```

### 5. Set Secrets

```bash
# RabbitMQ connection URL
wrangler secret put RABBITMQ_URL
# Enter: amqps://username:password@hostname/vhost

# Internal RPC service signing key
wrangler secret put INTERNAL_SIGNING_KEY
# Enter: your-hmac-signing-key

# EAS schema UIDs for Ethereum
wrangler secret put ETHEREUM_SCHEMA_UIDS
# Enter: {"capability":"0xYOUR_ETHEREUM_SCHEMA_UID"}

# EAS schema UIDs for Polygon
wrangler secret put POLYGON_SCHEMA_UIDS
# Enter: {"capability":"0xYOUR_POLYGON_SCHEMA_UID"}
```

## Deployment Steps

### 1. Install Dependencies

```bash
cd /Users/davidfisher/Integra/AAA-LAUNCH/repos/cloudflare-apps/integra-eas-worker
npm install
```

### 2. Type Check

```bash
npm run typecheck
```

Expected: No errors

### 3. Deploy to Production

```bash
npm run deploy
```

### 4. Verify Deployment

#### Test health endpoint

```bash
curl https://integra-eas-worker.YOUR_ACCOUNT.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "integra-eas-worker",
  "timestamp": "2025-11-05T..."
}
```

#### Check Durable Object

```bash
wrangler d1 execute --help
# Verify AttestationTracker is deployed
```

## Post-Deployment Configuration

### 1. Update Internal RPC Service

Configure the internal RPC service to send webhooks to:

```
POST https://integra-eas-worker.YOUR_ACCOUNT.workers.dev/webhooks/rpc
```

For EAS contract transactions on:
- Ethereum: `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587`
- Polygon: `0x5E634ef5355f45A855d02D66eCD687b1502AF790`

### 2. Update integra-ingestion-worker

Add tRPC client for `integra-eas-worker`:

```typescript
// In integra-ingestion-worker
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'integra-eas-worker';

const easClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://integra-eas-worker.YOUR_ACCOUNT.workers.dev/trpc',
    }),
  ],
});

// Usage
await easClient.createCapabilityAttestation.mutate({
  integraHash: '0x...',
  tokenId: 1,
  recipient: '0x...',
  chain: 'polygon',
  schemaUID: '0x...',
  capabilities: ['view', 'transfer'],
  userId: user.id,
  orgDatabase: 'ORG_DB_001',
});
```

### 3. Monitor Initial Traffic

```bash
# Tail logs
wrangler tail

# Watch for:
# - Workflow publications
# - Webhook receipts
# - Attestation confirmations
# - Any errors
```

## Rollback Procedure

If issues arise:

```bash
# 1. Check current deployments
wrangler deployments list

# 2. Rollback to previous version
wrangler rollback --message "Rollback due to [REASON]"

# 3. Verify rollback
curl https://integra-eas-worker.YOUR_ACCOUNT.workers.dev/health
```

## Monitoring

### Key Metrics to Watch

1. **Workflow Publication Rate**
   - Should match user attestation creation rate
   - Check RabbitMQ queue depths

2. **Webhook Success Rate**
   - Should be ~100% for valid signatures
   - Check for signature verification failures

3. **Attestation Confirmation Rate**
   - Should be >95% within 5 minutes
   - Check for timeouts in AttestationTracker

4. **Database Write Success**
   - Should be 100%
   - Check for schema mismatches

### Alerts to Set Up

1. **High timeout rate** (>5%)
   - Indicates blockchain execution issues

2. **Webhook signature failures**
   - Indicates signing key mismatch

3. **Database errors**
   - Indicates schema or permission issues

4. **Queue depth growing**
   - Indicates executor not consuming

## Troubleshooting

### Issue: Attestations not confirming

**Diagnosis:**
```bash
# Check AttestationTracker
# Query via tRPC: getAttestationStatus({ workflowId })
```

**Solutions:**
- Verify executor is running and consuming from queue
- Check RabbitMQ queue has messages
- Verify internal RPC service is sending webhooks

### Issue: Webhook signature failures

**Diagnosis:**
```bash
wrangler tail | grep "Invalid signature"
```

**Solutions:**
- Verify `INTERNAL_SIGNING_KEY` matches RPC service
- Check webhook body encoding (must be UTF-8)
- Verify signature calculation method (HMAC-SHA256)

### Issue: Database write failures

**Diagnosis:**
```bash
wrangler tail | grep "database"
```

**Solutions:**
- Verify `attestations` table exists in org database
- Check table schema matches specification
- Verify database binding is correct in wrangler.toml

## Testing

### End-to-End Test

1. Create test attestation via ingestion-worker
2. Monitor workflow publication in logs
3. Wait for blockchain confirmation (1-2 minutes)
4. Verify webhook received
5. Check attestation stored in database
6. Query via `getAttestationStatus`

### Load Test

```bash
# Send 100 attestation requests
# Monitor:
# - AttestationTracker memory usage
# - Webhook processing time
# - Database write latency
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review error logs
2. **Monthly**: Analyze timeout patterns
3. **Quarterly**: Review Durable Object cleanup logic

### Backup

User attestation data is stored in D1 databases which have automatic backups. No additional backup needed for the worker itself.

## Support Contacts

- **Technical Issues**: Integra Development Team
- **Cloudflare Issues**: Cloudflare Support
- **Specification Questions**: See `/v6-registration-resolver-eas/` documentation

---

**Deployment Status**: Ready for production
**Last Updated**: 2025-11-05
**Maintained By**: Integra Development Team
