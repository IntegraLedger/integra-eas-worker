/**
 * Workflow publishing functions
 * Pattern from integra-ingestion-worker
 */

import type { Env, WorkflowDefinition } from '../types';
import { publishToRabbitMQ } from './rabbitmq';

/**
 * Fetch workflow definition from shared-registry-prod
 */
export async function getWorkflow(
  env: Env,
  workflowName: string,
  version: string
): Promise<WorkflowDefinition> {
  const result = await env.SHARED_REGISTRY_PROD.prepare(
    `SELECT * FROM workflow_library WHERE name = ? AND version = ?`
  )
    .bind(workflowName, version)
    .first<{
      id: string;
      name: string;
      version: string;
      category: string;
      workflow: string;
    }>();

  if (!result) {
    throw new Error(`Workflow not found: ${workflowName} v${version}`);
  }

  return {
    id: result.id,
    name: result.name,
    version: result.version,
    category: result.category,
    workflow: JSON.parse(result.workflow),
  };
}

/**
 * Publish workflow execution message to RabbitMQ
 */
export async function publishWorkflowExecution(
  workflow: WorkflowDefinition,
  parameters: Record<string, any>,
  env: Env
): Promise<string> {
  const workflowId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();

  // Build queue message
  const queueMessage = {
    type: 'workflow_execution',
    workflowId,
    correlationId,
    workflow: {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      definition: workflow.workflow,
    },
    parameters,
    metadata: {
      source: 'integra-eas-worker',
      userId: parameters.userId,
      timestamp: new Date().toISOString(),
    },
  };

  console.log('Publishing workflow to RabbitMQ:', {
    workflowId,
    workflowName: workflow.name,
    chain: parameters.chain,
  });

  // Publish to RabbitMQ via HTTP API
  await publishToRabbitMQ(queueMessage, parameters.chain, env);

  return workflowId;
}
