/**
 * tRPC Router for EAS operations
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context';
import { getWorkflow, publishWorkflowExecution } from '../lib/workflows';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// TODO: Add proper authentication middleware
const protectedProcedure = t.procedure;

/**
 * Main attestation router
 */
export const appRouter = router({
  /**
   * Create a capability attestation for document token access
   */
  createCapabilityAttestation: protectedProcedure
    .input(
      z.object({
        integraHash: z.string(),
        tokenId: z.number(),
        recipient: z.string(),
        chain: z.enum(['ethereum', 'polygon']),
        schemaUID: z.string(),
        capabilities: z.array(z.string()),
        expirationTime: z.number().optional(),
        revocable: z.boolean().optional(),
        userId: z.string(),
        orgDatabase: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch workflow definition
      const workflow = await getWorkflow(ctx.env, 'create-capability-attestation', '2.0.0');

      // Prepare workflow parameters
      const workflowParams = {
        integraHash: input.integraHash,
        tokenId: input.tokenId,
        recipient: input.recipient,
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        schemaUID: input.schemaUID,
        capabilities: input.capabilities,
        expirationTime: input.expirationTime || 0,
        revocable: input.revocable ?? true,
        // User context for later
        userId: input.userId,
        orgDatabase: input.orgDatabase,
      };

      // Publish workflow execution
      const workflowId = await publishWorkflowExecution(workflow, workflowParams, ctx.env);

      // Register in AttestationTracker
      const tracker = ctx.env.ATTESTATION_TRACKER.get(
        ctx.env.ATTESTATION_TRACKER.idFromName('global')
      );

      await tracker.registerPending({
        workflowId,
        userId: input.userId,
        orgDatabase: input.orgDatabase,
        integraHash: input.integraHash,
        tokenId: input.tokenId,
        recipient: input.recipient,
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        startTime: Date.now(),
        timeoutMs: 300000, // 5 minutes
      });

      return {
        success: true,
        workflowId,
        message: 'Attestation workflow submitted',
      };
    }),

  /**
   * Revoke a capability attestation
   */
  revokeCapabilityAttestation: protectedProcedure
    .input(
      z.object({
        attestationUID: z.string(),
        chain: z.enum(['ethereum', 'polygon']),
        userId: z.string(),
        orgDatabase: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch workflow definition
      const workflow = await getWorkflow(ctx.env, 'revoke-capability-attestation', '2.0.0');

      // Prepare workflow parameters
      const workflowParams = {
        attestationUID: input.attestationUID,
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        userId: input.userId,
        orgDatabase: input.orgDatabase,
      };

      // Publish workflow execution
      const workflowId = await publishWorkflowExecution(workflow, workflowParams, ctx.env);

      // Register in AttestationTracker
      const tracker = ctx.env.ATTESTATION_TRACKER.get(
        ctx.env.ATTESTATION_TRACKER.idFromName('global')
      );

      await tracker.registerPending({
        workflowId,
        userId: input.userId,
        orgDatabase: input.orgDatabase,
        integraHash: '', // Not applicable for revocation
        tokenId: 0,
        recipient: '', // Not applicable
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        startTime: Date.now(),
        timeoutMs: 300000,
      });

      return {
        success: true,
        workflowId,
        message: 'Revocation workflow submitted',
      };
    }),

  /**
   * Create multiple attestations in a batch
   */
  batchCreateAttestations: protectedProcedure
    .input(
      z.object({
        attestations: z.array(
          z.object({
            integraHash: z.string(),
            tokenId: z.number(),
            recipient: z.string(),
            capabilities: z.array(z.string()),
          })
        ),
        chain: z.enum(['ethereum', 'polygon']),
        schemaUID: z.string(),
        userId: z.string(),
        orgDatabase: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch workflow definition
      const workflow = await getWorkflow(ctx.env, 'batch-create-attestations', '2.0.0');

      // Prepare workflow parameters
      const workflowParams = {
        attestations: input.attestations,
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        schemaUID: input.schemaUID,
        userId: input.userId,
        orgDatabase: input.orgDatabase,
      };

      // Publish workflow execution
      const workflowId = await publishWorkflowExecution(workflow, workflowParams, ctx.env);

      // Register in AttestationTracker
      const tracker = ctx.env.ATTESTATION_TRACKER.get(
        ctx.env.ATTESTATION_TRACKER.idFromName('global')
      );

      // Register batch operation
      await tracker.registerPending({
        workflowId,
        userId: input.userId,
        orgDatabase: input.orgDatabase,
        integraHash: input.attestations[0]?.integraHash || '',
        tokenId: input.attestations[0]?.tokenId || 0,
        recipient: input.attestations[0]?.recipient || '',
        chain: input.chain,
        chainId: input.chain === 'ethereum' ? 1 : 137,
        startTime: Date.now(),
        timeoutMs: 300000,
      });

      return {
        success: true,
        workflowId,
        count: input.attestations.length,
        message: `Batch attestation workflow submitted (${input.attestations.length} attestations)`,
      };
    }),

  /**
   * Get status of an attestation workflow
   */
  getAttestationStatus: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tracker = ctx.env.ATTESTATION_TRACKER.get(
        ctx.env.ATTESTATION_TRACKER.idFromName('global')
      );

      const status = await tracker.getStatus(input.workflowId);

      if (!status) {
        return {
          found: false,
          message: 'Workflow not found',
        };
      }

      return {
        found: true,
        status: status.status,
        attestationUID: status.attestationUID,
        confirmedAt: status.confirmedAt,
        error: status.error,
      };
    }),
});

export type AppRouter = typeof appRouter;
