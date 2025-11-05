# EAS Workflows

This directory contains workflow definitions for the Integra EAS (Ethereum Attestation Service) system.

## Workflows Added to shared-registry-prod

The following workflows have been added to the `workflow_library` table in the `shared-registry-prod` database:

### 1. create-capability-attestation (v2.0.0)

**Purpose**: Creates an EAS attestation for document token access capabilities

**Workflow ID**: `create-capability-attestation`

**Input Parameters**:
- `integraHash` (string) - Unique identifier for the document (0x-prefixed 64-char hex)
- `tokenId` (number) - ERC-6909 token ID for the document
- `recipient` (string) - Address receiving the attestation (0x-prefixed 40-char hex)
- `schemaUID` (string) - EAS schema UID (0x-prefixed 64-char hex)
- `capabilities` (string[]) - Array of capability strings (e.g., ["read", "write", "share"])
- `expirationTime` (number, optional) - Unix timestamp for expiration (0 = never expires)
- `revocable` (boolean, optional) - Whether the attestation can be revoked (default: true)
- `userId` (string) - User ID for tracking
- `orgDatabase` (string) - Organization database name

**Blockchain Operation**:
- Contract: EAS
- Method: `attest`
- Encodes: `abi.encode(["bytes32", "uint256", "string[]"], [integraHash, tokenId, capabilities])`

**Outputs**:
- `attestationUID` - UID of the created attestation
- `transactionHash` - Transaction hash
- `blockNumber` - Block number

**Events Emitted**:
- `workflow.attestation.created`

---

### 2. revoke-capability-attestation (v2.0.0)

**Purpose**: Revokes an existing EAS attestation

**Workflow ID**: `revoke-capability-attestation`

**Input Parameters**:
- `attestationUID` (string) - UID of the attestation to revoke (0x-prefixed 64-char hex)
- `userId` (string) - User ID for tracking
- `orgDatabase` (string) - Organization database name

**Blockchain Operation**:
- Contract: EAS
- Method: `revoke`
- Encodes: `abi.encode(["bytes32"], [attestationUID])`

**Outputs**:
- `transactionHash` - Transaction hash
- `blockNumber` - Block number

**Events Emitted**:
- `workflow.attestation.revoked`

---

### 3. batch-create-attestations (v2.0.0)

**Purpose**: Creates multiple EAS attestations in a single transaction

**Workflow ID**: `batch-create-attestations`

**Input Parameters**:
- `attestations` (array) - Array of attestation objects, each containing:
  - `integraHash` (string) - Document identifier
  - `tokenId` (number) - Token ID
  - `recipient` (string) - Recipient address
  - `capabilities` (string[]) - Capabilities array
- `schemaUID` (string) - EAS schema UID (same for all attestations)
- `userId` (string) - User ID for tracking
- `orgDatabase` (string) - Organization database name

**Blockchain Operation**:
- Contract: EAS
- Method: `multiAttest`
- Creates multiple attestations in one transaction

**Outputs**:
- `attestationUIDs` - Array of UIDs for created attestations
- `transactionHash` - Transaction hash
- `blockNumber` - Block number
- `count` - Number of attestations created

**Events Emitted**:
- `workflow.attestation.batch-created`

---

## Workflow Properties

All workflows share these common properties:

### Retry Policy
- Maximum attempts: 3
- Initial interval: 5s (10s for batch)
- Maximum interval: 30s (60s for batch)
- Backoff coefficient: 2 (exponential backoff)

### Timeout
- Single attestation: 180s (3 minutes)
- Batch attestation: 300s (5 minutes)

### Blockchain Configuration
- Contract type: `eas`
- Contract version: `v1.3.0`
- Chains supported: `ethereum`, `polygon`

### Metadata
- Tags: `["eas", "attestation", "capability", "access-control"]`
- Tier: 2
- Category: `attestation`
- Permissions:
  - Create: `eas.attestation.create`
  - Revoke: `eas.attestation.revoke`

---

## Usage in integra-eas-worker

These workflows are referenced in the tRPC router endpoints:

### Create Attestation
```typescript
const workflow = await getWorkflow(env, 'create-capability-attestation', '2.0.0');
const workflowId = await publishWorkflowExecution(workflow, workflowParams, env);
```

### Revoke Attestation
```typescript
const workflow = await getWorkflow(env, 'revoke-capability-attestation', '2.0.0');
const workflowId = await publishWorkflowExecution(workflow, workflowParams, env);
```

### Batch Create Attestations
```typescript
const workflow = await getWorkflow(env, 'batch-create-attestations', '2.0.0');
const workflowId = await publishWorkflowExecution(workflow, workflowParams, env);
```

---

## Installation

The workflows have been added to the `shared-registry-prod` database using:

```bash
wrangler d1 execute shared-registry-prod --file=workflows/eas-workflows.sql --remote
```

**Result**: 3 workflows inserted successfully (6 rows written)

---

## Verification

To verify the workflows exist:

```bash
wrangler d1 execute shared-registry-prod --command "SELECT workflow_id, name, version FROM workflow_library WHERE workflow_id LIKE '%attestation%';" --remote
```

Expected output:
- create-capability-attestation (v2.0.0)
- revoke-capability-attestation (v2.0.0)
- batch-create-attestations (v2.0.0)

---

## Workflow Execution Flow

1. **Client calls tRPC endpoint** (e.g., `createCapabilityAttestation`)
2. **Worker fetches workflow** from `workflow_library` table
3. **Worker publishes to RabbitMQ** (ethereum.eas or polygon.eas queue)
4. **Blockchain execution worker** picks up message
5. **Smart contract interaction** (EAS.attest or EAS.revoke)
6. **Transaction mined** on blockchain
7. **Internal RPC webhook** sends confirmation to integra-eas-worker
8. **Worker stores attestation** in user org database
9. **AttestationTracker updated** with confirmation

---

## Schema UIDs

The workflows expect EAS schema UIDs to be provided as input. These are configured per chain:

**Ethereum** (chain ID 1):
- Set via environment variable: `ETHEREUM_SCHEMA_UIDS`

**Polygon** (chain ID 137):
- Set via environment variable: `POLYGON_SCHEMA_UIDS`

The schema format is:
```
abi.encode(["bytes32", "uint256", "string[]"], [integraHash, tokenId, capabilities])
```

This encodes:
- `integraHash` - Document identifier (bytes32)
- `tokenId` - ERC-6909 token ID (uint256)
- `capabilities` - Access capabilities (string[])

---

## GitHub SHA References

The workflows use placeholder GitHub SHAs:
- create-capability-attestation: `0000000000000000000000000000000000000001`
- revoke-capability-attestation: `0000000000000000000000000000000000000002`
- batch-create-attestations: `0000000000000000000000000000000000000003`

These will be updated when the workflows are committed to version control in the workflow definitions repository.

---

## Date Added

**2025-11-05**: Initial workflow definitions added to shared-registry-prod

---

## Related Documentation

- **V6 Specification**: `/v6-registration-resolver-eas/INTEGRA-EAS-WORKER-FINAL.md`
- **Implementation**: `/repos/cloudflare-apps/integra-eas-worker/src/trpc/router.ts`
- **Workflow Publishing**: `/repos/cloudflare-apps/integra-eas-worker/src/lib/workflows.ts`
- **Database Schema**: `/repos/cloudflare-apps/integra-eas-worker/migrations/001_create_attestations_table.sql`
