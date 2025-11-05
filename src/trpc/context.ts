/**
 * tRPC context creation
 */

import type { Env } from '../types';

export interface Context {
  env: Env;
  user?: {
    id: string;
    orgDatabase: string;
    primaryAddress: string;
  };
}

/**
 * Create tRPC context from request
 */
export async function createContext(request: Request, env: Env): Promise<Context> {
  // TODO: Add authentication here
  // For now, return basic context
  return {
    env,
  };
}
