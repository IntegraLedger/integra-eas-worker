/**
 * RabbitMQ publishing via CloudAMQP HTTP API
 * Pattern from integra-ingestion-worker
 */

import type { Env } from '../types';

/**
 * Publish message to RabbitMQ via CloudAMQP HTTP API
 */
export async function publishToRabbitMQ(
  message: any,
  chain: 'ethereum' | 'polygon',
  env: Env
): Promise<void> {
  if (!env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL not configured');
  }

  // Parse RabbitMQ URL: amqps://user:pass@host/vhost
  const match = env.RABBITMQ_URL.match(/amqps?:\/\/(\w+):([^@]+)@([\w.-]+)\/(\w+)/);
  if (!match) {
    throw new Error('Invalid RabbitMQ URL format');
  }

  const [, username, password, hostname, vhost] = match;

  // Determine queue name based on chain
  const queueName = chain === 'ethereum' ? 'ethereum.eas' : 'polygon.eas';

  // CloudAMQP HTTP API endpoint
  const apiUrl = `https://${hostname}/api/exchanges/${encodeURIComponent(vhost)}/amq.default/publish`;

  const payload = {
    properties: {
      delivery_mode: 2, // Persistent
      content_type: 'application/json',
      correlation_id: message.correlationId,
    },
    routing_key: queueName,
    payload: JSON.stringify(message),
    payload_encoding: 'string',
  };

  console.log('Publishing to RabbitMQ:', {
    url: apiUrl,
    queue: queueName,
    correlationId: message.correlationId,
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${username}:${password}`),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('RabbitMQ publish failed:', response.status, error);
    throw new Error(`Failed to publish to RabbitMQ: ${response.status} - ${error}`);
  }

  const responseBody = await response.json();
  console.log('RabbitMQ publish successful:', responseBody);
}
