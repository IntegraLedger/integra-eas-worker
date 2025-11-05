/**
 * integra-eas-worker - Main Entry Point
 *
 * Consolidated Cloudflare Worker for EAS attestation operations
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { handleRPCWebhook } from './handlers/rpc-webhook';
import type { Env } from './types';

// Export Durable Object
export { AttestationTracker } from './durable-objects/AttestationTracker';

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'integra-eas-worker',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // RPC webhook endpoint (from internal RPC service)
    if (path === '/webhooks/rpc' && request.method === 'POST') {
      return handleRPCWebhook(request, env);
    }

    // tRPC endpoint
    if (path.startsWith('/trpc')) {
      return fetchRequestHandler({
        endpoint: '/trpc',
        req: request,
        router: appRouter,
        createContext: () => createContext(request, env),
        onError: ({ error, path }) => {
          console.error(`tRPC error on ${path}:`, error);
        },
      });
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  },
};
