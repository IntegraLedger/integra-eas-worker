/**
 * RPC Webhook Handler
 * Receives webhooks from internal RPC service when EAS transactions confirm
 * Pattern from integra-rpc-webhook-worker
 */

import type { Env, AlchemyWebhook, NETWORK_TO_CHAIN_ID } from '../types';
import { verifyInternalSignature } from '../lib/signature';
import { decodeEASEvent, decodeRevokedEvent } from '../lib/eas-decoder';
import { storeAttestation, revokeAttestationInDB } from '../lib/database';

const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ETH_MAINNET: 1,
  MATIC_MAINNET: 137,
};

/**
 * Handle incoming RPC webhook
 */
export async function handleRPCWebhook(request: Request, env: Env): Promise<Response> {
  try {
    // 1. Verify signature (internal RPC service signature)
    const signature = request.headers.get('x-integra-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    const body = await request.text();
    const isValid = await verifyInternalSignature(body, signature, env.INTERNAL_SIGNING_KEY);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Parse webhook payload
    const webhook: AlchemyWebhook = JSON.parse(body);
    const chainId = NETWORK_TO_CHAIN_ID[webhook.network];

    console.log('Received RPC webhook:', {
      network: webhook.network,
      chainId,
      activityCount: webhook.activity.length,
    });

    // 3. Process each activity
    const results = await Promise.allSettled(
      webhook.activity.map((activity) => processEASActivity(activity, chainId, env))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log('Webhook processing complete:', { total: results.length, successful, failed });

    return new Response(JSON.stringify({ success: true, processed: successful, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Process EAS transaction activity
 */
async function processEASActivity(activity: any, chainId: number, env: Env): Promise<void> {
  const txHash = activity.hash;
  if (!txHash) {
    console.warn('Activity missing transaction hash');
    return;
  }

  // Check if EAS contract
  const easAddress = activity.toAddress?.toLowerCase();
  const expectedEAS =
    chainId === 1
      ? '0xa1207f3bba224e2c9c3c6d5af63d0eb1582ce587' // Ethereum
      : '0x5e634ef5355f45a855d02d66ecd687b1502af790'; // Polygon

  if (easAddress !== expectedEAS) {
    console.log('Not an EAS contract transaction, skipping');
    return;
  }

  console.log('Processing EAS transaction:', { txHash, chainId });

  // Decode EAS event
  if (!activity.log) {
    console.warn('No log data in activity');
    return;
  }

  // Try to decode as Attested event
  const attestedData = decodeEASEvent(activity.log);
  if (attestedData) {
    await handleAttestedEvent(attestedData, activity, chainId, txHash, env);
    return;
  }

  // Try to decode as Revoked event
  const revokedData = decodeRevokedEvent(activity.log);
  if (revokedData) {
    await handleRevokedEvent(revokedData, activity, chainId, txHash, env);
    return;
  }

  console.warn('Could not decode EAS event');
}

/**
 * Handle Attested event
 */
async function handleAttestedEvent(
  attestationData: any,
  activity: any,
  chainId: number,
  txHash: string,
  env: Env
): Promise<void> {
  // Get context from AttestationTracker
  const tracker = env.ATTESTATION_TRACKER.get(env.ATTESTATION_TRACKER.idFromName('global'));

  const context = await tracker.getContextByTxHash(txHash);
  if (!context) {
    console.warn('No context found for transaction:', txHash);
    return;
  }

  // Store attestation in user's org database
  const orgDb = env[context.orgDatabase as keyof Env] as D1Database;
  if (!orgDb) {
    console.error('Org database not found:', context.orgDatabase);
    return;
  }

  await storeAttestation(orgDb, {
    attestationUid: attestationData.uid,
    schemaUid: attestationData.schemaUID,
    integraHash: context.integraHash,
    tokenId: context.tokenId,
    attestationType: 'document',
    relatesTo: context.recipient,
    chain: chainId === 1 ? 'ethereum' : 'polygon',
    chainId,
    attester: attestationData.attester,
    recipient: attestationData.recipient,
    attestationData: JSON.stringify(attestationData),
    decodedData: null, // Can decode schema data if needed
    refUid: null,
    expirationTime: 0,
    revocationTime: 0,
    isRevoked: 0,
    dateOfIssue: Math.floor(Date.now() / 1000),
    transactionHash: txHash,
    blockNumber: parseInt(activity.blockNum, 16),
    direction: 'sent', // User created this attestation
    notes: null,
  });

  // Mark as confirmed in tracker
  await tracker.markConfirmed(txHash, attestationData.uid);

  console.log('Attestation stored successfully:', {
    attestationUid: attestationData.uid,
    user: context.userId,
  });
}

/**
 * Handle Revoked event
 */
async function handleRevokedEvent(
  revokedData: any,
  activity: any,
  chainId: number,
  txHash: string,
  env: Env
): Promise<void> {
  // Get context from AttestationTracker
  const tracker = env.ATTESTATION_TRACKER.get(env.ATTESTATION_TRACKER.idFromName('global'));

  const context = await tracker.getContextByTxHash(txHash);
  if (!context) {
    console.warn('No context found for revocation transaction:', txHash);
    return;
  }

  // Update attestation in user's org database
  const orgDb = env[context.orgDatabase as keyof Env] as D1Database;
  if (!orgDb) {
    console.error('Org database not found:', context.orgDatabase);
    return;
  }

  const revocationTime = Math.floor(Date.now() / 1000);
  await revokeAttestationInDB(orgDb, revokedData.uid, revocationTime);

  console.log('Attestation revoked successfully:', {
    attestationUid: revokedData.uid,
    user: context.userId,
  });
}
