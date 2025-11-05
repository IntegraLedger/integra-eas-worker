/**
 * AttestationTracker Durable Object
 *
 * Tracks pending attestations and maps transaction hashes to user context.
 * Handles timeouts and cleanup.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, PendingAttestation } from '../types';

export class AttestationTracker extends DurableObject<Env> {
  private attestations: Map<string, PendingAttestation> = new Map();
  private txHashIndex: Map<string, string> = new Map(); // txHash → workflowId

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    // Load state from storage on initialization
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<{
        attestations: Array<[string, PendingAttestation]>;
        txHashIndex: Array<[string, string]>;
      }>('state');

      if (stored) {
        this.attestations = new Map(stored.attestations);
        this.txHashIndex = new Map(stored.txHashIndex);
      }
    });
  }

  /**
   * Register a pending attestation (called when workflow is published)
   */
  async registerPending(attestation: Omit<PendingAttestation, 'status'>): Promise<void> {
    const record: PendingAttestation = {
      ...attestation,
      status: 'pending',
    };

    this.attestations.set(attestation.workflowId, record);
    await this.persist();

    // Set alarm for timeout checking if not already set
    const nextAlarm = await this.ctx.storage.getAlarm();
    if (!nextAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + 30000); // Check every 30 seconds
    }

    console.log('Registered pending attestation:', {
      workflowId: attestation.workflowId,
      userId: attestation.userId,
      chain: attestation.chain,
    });
  }

  /**
   * Update with transaction hash (called by executor after tx submitted)
   */
  async setTransactionHash(workflowId: string, txHash: string): Promise<void> {
    const attestation = this.attestations.get(workflowId);
    if (!attestation) {
      throw new Error(`Attestation ${workflowId} not found`);
    }

    attestation.txHash = txHash;
    this.txHashIndex.set(txHash, workflowId);
    await this.persist();

    console.log('Transaction hash set:', { workflowId, txHash });
  }

  /**
   * Get context by transaction hash (called by webhook handler)
   */
  async getContextByTxHash(txHash: string): Promise<PendingAttestation | null> {
    const workflowId = this.txHashIndex.get(txHash);
    if (!workflowId) {
      console.warn('No workflow found for tx hash:', txHash);
      return null;
    }

    const attestation = this.attestations.get(workflowId);
    return attestation || null;
  }

  /**
   * Mark attestation as confirmed
   */
  async markConfirmed(txHash: string, attestationUID: string): Promise<void> {
    const workflowId = this.txHashIndex.get(txHash);
    if (!workflowId) {
      console.warn(`No workflow found for tx hash: ${txHash}`);
      return;
    }

    const attestation = this.attestations.get(workflowId);
    if (!attestation) {
      console.warn(`No attestation found for workflow: ${workflowId}`);
      return;
    }

    attestation.status = 'confirmed';
    attestation.attestationUID = attestationUID;
    attestation.confirmedAt = Date.now();

    await this.persist();

    console.log('Attestation confirmed:', {
      workflowId,
      attestationUID,
      userId: attestation.userId,
    });

    // Schedule cleanup after 1 hour (keep for debugging)
    setTimeout(() => {
      this.attestations.delete(workflowId);
      if (attestation.txHash) {
        this.txHashIndex.delete(attestation.txHash);
      }
      this.persist();
    }, 3600000);
  }

  /**
   * Get status of a workflow
   */
  async getStatus(workflowId: string): Promise<PendingAttestation | null> {
    return this.attestations.get(workflowId) || null;
  }

  /**
   * Alarm handler - check for timeouts
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [workflowId, attestation] of this.attestations.entries()) {
      if (attestation.status !== 'pending') continue;

      const elapsed = now - attestation.startTime;
      if (elapsed > attestation.timeoutMs) {
        attestation.status = 'timeout';
        attestation.error = `Timeout after ${attestation.timeoutMs}ms`;
        timedOut.push(workflowId);
      }
    }

    if (timedOut.length > 0) {
      console.warn('Attestations timed out:', timedOut);
      await this.persist();
    }

    // Set next alarm if still have pending attestations
    const hasPending = Array.from(this.attestations.values()).some(
      (a) => a.status === 'pending'
    );

    if (hasPending) {
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }
  }

  /**
   * Persist state to durable storage
   */
  private async persist(): Promise<void> {
    await this.ctx.storage.put('state', {
      attestations: Array.from(this.attestations.entries()),
      txHashIndex: Array.from(this.txHashIndex.entries()),
    });
  }

  /**
   * Get all pending attestations (for debugging)
   */
  async getPending(): Promise<PendingAttestation[]> {
    return Array.from(this.attestations.values()).filter(
      (a) => a.status === 'pending'
    );
  }

  /**
   * Clear all attestations (for testing/debugging)
   */
  async clear(): Promise<void> {
    this.attestations.clear();
    this.txHashIndex.clear();
    await this.ctx.storage.deleteAll();
    console.log('AttestationTracker cleared');
  }
}
