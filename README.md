# integra-eas-worker

Cloudflare Worker for EAS (Ethereum Attestation Service) attestation operations in the Integra V6 system.

## Overview

The `integra-eas-worker` is a consolidated worker that handles all EAS functionality:

- **Workflow Publishing**: Publishes attestation workflows to RabbitMQ (like `integra-ingestion-worker`)
- **Webhook Receiving**: Receives transaction confirmations from internal RPC service (like `integra-rpc-webhook-worker`)
- **State Management**: Tracks pending attestations via `AttestationTracker` Durable Object
- **Database Operations**: Stores attestations in user org databases

## Architecture

```
Frontend/ingestion-worker
    ↓ tRPC calls
integra-eas-worker (tRPC endpoints)
    ↓ publishes workflows
RabbitMQ (ethereum.eas / polygon.eas queues)
    ↓ consumed by
Blockchain Executors
    ↓ execute EAS contract calls
Internal RPC Service
    ↓ webhooks
integra-eas-worker (/webhooks/rpc)
    ↓ stores attestations
User Org Databases (attestations table)
```

## Key Components

### Durable Objects

**AttestationTracker** (`src/durable-objects/AttestationTracker.ts`)
- Tracks pending attestations
- Maps transaction hashes to user context
- Handles timeouts (5 minute default)
- Automatic cleanup after confirmation

### tRPC Endpoints

**createCapabilityAttestation**
- Create attestation for token access
- Returns workflow ID for tracking

**revokeCapabilityAttestation**
- Revoke existing attestation
- Updates database status

**batchCreateAttestations**
- Create multiple attestations in one transaction
- Gas efficient for multi-party documents

**getAttestationStatus**
- Query status of attestation workflow
- Check if confirmed or timed out

### Webhook Handler

**POST /webhooks/rpc**
- Receives webhooks from internal RPC service
- Verifies HMAC-SHA256 signature
- Decodes EAS events (Attested, Revoked)
- Stores in user databases
- Updates AttestationTracker

## Environment Setup

### Required Secrets

Set via `wrangler secret put <NAME>`:

```bash
wrangler secret put RABBITMQ_URL
# amqps://username:password@hostname/vhost

wrangler secret put INTERNAL_SIGNING_KEY
# HMAC key for webhook signature verification

wrangler secret put ETHEREUM_SCHEMA_UIDS
# JSON: {"capability": "0x1234..."}

wrangler secret put POLYGON_SCHEMA_UIDS
# JSON: {"capability": "0x5678..."}
```

### wrangler.toml Configuration

Update the following in `wrangler.toml`:

1. **SHARED_REGISTRY_PROD database_id**
2. **User org database bindings** (ORG_DB_001, etc.)

## Development

### Install Dependencies

```bash
npm install
```

### Type Check

```bash
npm run typecheck
```

### Run Locally

```bash
npm run dev
```

### Deploy

```bash
npm run deploy
```

## Testing

### Health Check

```bash
curl https://integra-eas-worker.YOUR_ACCOUNT.workers.dev/health
```

### Test tRPC Endpoint (via ingestion-worker)

The tRPC endpoints are called internally by `integra-ingestion-worker`.

### Test Webhook (Internal Only)

Webhooks are sent by the internal RPC service with proper HMAC signatures.

## Database Schema

The worker expects an `attestations` table in each user org database. See the V6 specification for the complete schema:

```sql
CREATE TABLE IF NOT EXISTS attestations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_uid TEXT NOT NULL UNIQUE,
  schema_uid TEXT NOT NULL,
  integra_hash TEXT,
  token_id INTEGER,
  attestation_type TEXT NOT NULL,
  relates_to TEXT NOT NULL,
  chain TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  attester TEXT NOT NULL,
  recipient TEXT NOT NULL,
  attestation_data TEXT NOT NULL,
  decoded_data TEXT,
  ref_uid TEXT,
  expiration_time INTEGER,
  revocation_time INTEGER DEFAULT 0,
  is_revoked INTEGER DEFAULT 0,
  date_of_issue INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  transaction_hash TEXT,
  block_number INTEGER,
  direction TEXT NOT NULL,
  notes TEXT,
  CHECK (attestation_type IN ('document', 'individual', 'organization')),
  CHECK (chain IN ('ethereum', 'polygon')),
  CHECK (direction IN ('sent', 'received')),
  CHECK (is_revoked IN (0, 1)),
  CHECK (chain_id IN (1, 137))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attestations_uid ON attestations(attestation_uid);
CREATE INDEX IF NOT EXISTS idx_attestations_integra_hash ON attestations(integra_hash) WHERE integra_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attestations_recipient ON attestations(recipient);
CREATE INDEX IF NOT EXISTS idx_attestations_attester ON attestations(attester);
CREATE INDEX IF NOT EXISTS idx_attestations_direction ON attestations(direction);
CREATE INDEX IF NOT EXISTS idx_attestations_type ON attestations(attestation_type);
CREATE INDEX IF NOT EXISTS idx_attestations_chain ON attestations(chain);
CREATE INDEX IF NOT EXISTS idx_attestations_revoked ON attestations(is_revoked) WHERE is_revoked = 0;
CREATE INDEX IF NOT EXISTS idx_attestations_date ON attestations(date_of_issue DESC);
CREATE INDEX IF NOT EXISTS idx_attestations_relates_to ON attestations(relates_to);
```

## Workflow Definitions

The worker expects these workflows in `shared-registry-prod.workflow_library`:

1. **create-capability-attestation** (v2.0.0)
2. **revoke-capability-attestation** (v2.0.0)
3. **batch-create-attestations** (v2.0.0)

## Integration

### Called By

- `integra-ingestion-worker` (tRPC client)
- Internal RPC Service (webhook POST)

### Calls

- `shared-registry-prod` (workflow definitions)
- RabbitMQ (CloudAMQP HTTP API)
- User org databases (D1)

### Consumes

Messages from:
- `ethereum.eas` queue
- `polygon.eas` queue

## Monitoring

### Logs

```bash
wrangler tail
```

### Key Metrics

- Workflow publish success rate
- Webhook processing time
- Attestation confirmation rate
- Timeout rate

## Troubleshooting

### Attestation Not Confirming

1. Check AttestationTracker status via `getAttestationStatus`
2. Verify webhook is being received
3. Check RabbitMQ queue depth
4. Verify executor is processing messages

### Webhook Signature Failures

1. Verify `INTERNAL_SIGNING_KEY` matches RPC service
2. Check webhook body encoding (UTF-8)
3. Review signature calculation method

### Database Errors

1. Verify org database binding exists in wrangler.toml
2. Check `attestations` table schema
3. Verify user has permissions

## Architecture Decisions

This worker follows the **consolidated single-worker pattern** as decided in the V6 specification:

✅ **Why Consolidated?**
- Simpler mental model
- Easier deployment and maintenance
- Better for small teams
- Follows industry best practices
- All EAS logic in one place

## Related Documentation

- V6 Specification: `/v6-registration-resolver-eas/INTEGRA-EAS-WORKER-FINAL.md`
- Message Queue Updates: `/v6-registration-resolver-eas/MESSAGE-QUEUE-UPDATES.md`
- Database Schema: `/v6-registration-resolver-eas/USER-ORG-ATTESTATIONS-TABLE.md`

## License

ISC - Integra Ledger

## Support

For issues or questions, refer to the V6 specification documentation or contact the Integra development team.
