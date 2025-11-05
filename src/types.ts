/**
 * Type definitions for integra-eas-worker
 */

export interface Env {
  // Durable Objects
  ATTESTATION_TRACKER: DurableObjectNamespace;

  // D1 Databases
  SHARED_REGISTRY_PROD: D1Database;
  // User org databases (dynamically bound)
  [key: `ORG_DB_${string}`]: D1Database;

  // Environment Variables
  ETHEREUM_EAS_ADDRESS: string;
  POLYGON_EAS_ADDRESS: string;

  // Secrets
  RABBITMQ_URL: string;
  INTERNAL_SIGNING_KEY: string;
  ETHEREUM_SCHEMA_UIDS: string; // JSON string
  POLYGON_SCHEMA_UIDS: string; // JSON string
}

export interface PendingAttestation {
  workflowId: string;
  txHash?: string; // Set when executor starts transaction
  userId: string;
  orgDatabase: string;
  integraHash: string;
  tokenId: number;
  recipient: string;
  chain: 'ethereum' | 'polygon';
  chainId: number;
  startTime: number;
  timeoutMs: number;
  status: 'pending' | 'confirmed' | 'timeout' | 'error';
  attestationUID?: string;
  confirmedAt?: number;
  error?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  category: string;
  workflow: {
    steps: Array<{
      id: string;
      type: string;
      action: string;
      params: Record<string, any>;
      output?: string;
    }>;
  };
}

export interface AttestationRecord {
  attestationUid: string;
  schemaUid: string;
  integraHash: string | null;
  tokenId: number | null;
  attestationType: 'document' | 'individual' | 'organization';
  relatesTo: string;
  chain: 'ethereum' | 'polygon';
  chainId: number;
  attester: string;
  recipient: string;
  attestationData: string;
  decodedData: string | null;
  refUid: string | null;
  expirationTime: number;
  revocationTime: number;
  isRevoked: 0 | 1;
  dateOfIssue: number;
  transactionHash: string;
  blockNumber: number;
  direction: 'sent' | 'received';
  notes: string | null;
}

export interface AlchemyWebhook {
  network: 'MATIC_MAINNET' | 'ETH_MAINNET';
  activity: Array<{
    hash: string;
    blockNum: string;
    fromAddress: string;
    toAddress: string;
    category: string;
    log?: {
      address: string;
      topics: string[];
      data: string;
    };
  }>;
}

export interface DecodedEASEvent {
  uid: string;
  schemaUID: string;
  attester: string;
  recipient: string;
}

// Network to Chain ID mapping
export const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ETH_MAINNET: 1,
  MATIC_MAINNET: 137,
};
