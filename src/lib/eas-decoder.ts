/**
 * EAS event decoding utilities
 */

import { ethers } from 'ethers';
import type { DecodedEASEvent } from '../types';

/**
 * Decode EAS Attested event from transaction log
 */
export function decodeEASEvent(log: any): DecodedEASEvent | null {
  try {
    // EAS Attested event signature
    // event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)
    const ATTESTED_SIGNATURE = ethers.id('Attested(address,address,bytes32,bytes32)');

    if (log.topics[0] !== ATTESTED_SIGNATURE) {
      console.log('Not an Attested event');
      return null;
    }

    // Decode indexed parameters (topics)
    // topics[0] = event signature
    // topics[1] = recipient (indexed)
    // topics[2] = attester (indexed)
    // topics[3] = schemaUID (indexed)
    const recipient = '0x' + log.topics[1].slice(26); // Remove padding
    const attester = '0x' + log.topics[2].slice(26);
    const schemaUID = log.topics[3];

    // Decode non-indexed parameter (data)
    // data contains: bytes32 uid
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [uid] = abiCoder.decode(['bytes32'], log.data);

    return {
      uid,
      schemaUID,
      attester,
      recipient,
    };
  } catch (error) {
    console.error('Failed to decode EAS event:', error);
    return null;
  }
}

/**
 * Decode EAS Revoked event from transaction log
 */
export function decodeRevokedEvent(log: any): { uid: string; schemaUID: string; revoker: string } | null {
  try {
    // EAS Revoked event signature
    // event Revoked(address indexed recipient, address indexed revoker, bytes32 uid, bytes32 indexed schemaUID)
    const REVOKED_SIGNATURE = ethers.id('Revoked(address,address,bytes32,bytes32)');

    if (log.topics[0] !== REVOKED_SIGNATURE) {
      console.log('Not a Revoked event');
      return null;
    }

    // topics[1] = recipient (indexed)
    // topics[2] = revoker (indexed)
    // topics[3] = schemaUID (indexed)
    const revoker = '0x' + log.topics[2].slice(26);
    const schemaUID = log.topics[3];

    // Decode non-indexed parameter
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [uid] = abiCoder.decode(['bytes32'], log.data);

    return {
      uid,
      schemaUID,
      revoker,
    };
  } catch (error) {
    console.error('Failed to decode Revoked event:', error);
    return null;
  }
}
