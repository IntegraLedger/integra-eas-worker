/**
 * Database operations for attestations table
 */

import type { AttestationRecord } from '../types';

/**
 * Store attestation in user's org database
 */
export async function storeAttestation(
  db: D1Database,
  attestation: AttestationRecord
): Promise<void> {
  await db
    .prepare(
      `
    INSERT INTO attestations (
      attestation_uid, schema_uid, integra_hash, token_id,
      attestation_type, relates_to, chain, chain_id,
      attester, recipient, attestation_data, decoded_data,
      ref_uid, expiration_time, revocation_time, is_revoked,
      date_of_issue, transaction_hash, block_number,
      direction, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      attestation.attestationUid,
      attestation.schemaUid,
      attestation.integraHash,
      attestation.tokenId,
      attestation.attestationType,
      attestation.relatesTo,
      attestation.chain,
      attestation.chainId,
      attestation.attester.toLowerCase(),
      attestation.recipient.toLowerCase(),
      attestation.attestationData,
      attestation.decodedData,
      attestation.refUid,
      attestation.expirationTime,
      attestation.revocationTime,
      attestation.isRevoked,
      attestation.dateOfIssue,
      attestation.transactionHash,
      attestation.blockNumber,
      attestation.direction,
      attestation.notes
    )
    .run();

  console.log('Attestation stored:', {
    attestationUid: attestation.attestationUid,
    chain: attestation.chain,
    recipient: attestation.recipient,
  });
}

/**
 * Update attestation revocation status
 */
export async function revokeAttestationInDB(
  db: D1Database,
  attestationUid: string,
  revocationTime: number
): Promise<void> {
  await db
    .prepare(
      `
    UPDATE attestations
    SET is_revoked = 1,
        revocation_time = ?,
        updated_at = unixepoch()
    WHERE attestation_uid = ?
  `
    )
    .bind(revocationTime, attestationUid)
    .run();

  console.log('Attestation revoked:', { attestationUid, revocationTime });
}

/**
 * Get attestation by UID
 */
export async function getAttestation(
  db: D1Database,
  attestationUid: string
): Promise<any | null> {
  return await db
    .prepare('SELECT * FROM attestations WHERE attestation_uid = ?')
    .bind(attestationUid)
    .first();
}

/**
 * Get attestations for a document
 */
export async function getAttestationsForDocument(
  db: D1Database,
  integraHash: string
): Promise<any[]> {
  const result = await db
    .prepare(
      `
    SELECT * FROM attestations
    WHERE integra_hash = ?
    ORDER BY date_of_issue DESC
  `
    )
    .bind(integraHash)
    .all();

  return result.results || [];
}

/**
 * Get attestations sent by user
 */
export async function getSentAttestations(
  db: D1Database,
  attesterAddress: string,
  limit: number = 50
): Promise<any[]> {
  const result = await db
    .prepare(
      `
    SELECT * FROM attestations
    WHERE direction = 'sent' AND attester = ?
    ORDER BY date_of_issue DESC
    LIMIT ?
  `
    )
    .bind(attesterAddress.toLowerCase(), limit)
    .all();

  return result.results || [];
}

/**
 * Get attestations received by user
 */
export async function getReceivedAttestations(
  db: D1Database,
  recipientAddress: string,
  limit: number = 50
): Promise<any[]> {
  const result = await db
    .prepare(
      `
    SELECT * FROM attestations
    WHERE direction = 'received' AND recipient = ?
    ORDER BY date_of_issue DESC
    LIMIT ?
  `
    )
    .bind(recipientAddress.toLowerCase(), limit)
    .all();

  return result.results || [];
}
