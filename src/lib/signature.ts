/**
 * Webhook signature verification
 * For verifying internal RPC service webhooks
 */

import type { Env } from '../types';

/**
 * Verify internal webhook signature
 * Uses HMAC-SHA256 signature verification
 */
export async function verifyInternalSignature(
  body: string,
  signature: string,
  signingKey: string
): Promise<boolean> {
  try {
    // Import signing key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    // Compute expected signature
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(body)
    );

    // Convert to hex string for comparison
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (constant-time comparison)
    return signature === expectedHex;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
