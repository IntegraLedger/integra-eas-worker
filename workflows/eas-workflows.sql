-- EAS Workflow Definitions for shared-registry-prod workflow_library table
-- To be inserted into shared-registry-prod database

-- Workflow 1: Create Capability Attestation
INSERT INTO workflow_library (workflow_id, name, version, manifest, github_sha, synced_at)
VALUES (
  'create-capability-attestation',
  'Create Capability Attestation',
  '2.0.0',
  '{
    "id": "create-capability-attestation",
    "name": "Create Capability Attestation",
    "version": "2.0.0",
    "integraId": 1,
    "category": "attestation",
    "description": "Creates an EAS attestation for document token access capabilities",
    "defaults": {
      "chain": "polygon",
      "expirationTime": 0,
      "revocable": true
    },
    "metadata": {
      "tags": ["eas", "attestation", "capability", "access-control"],
      "tier": 2,
      "category": "attestation",
      "permissions": ["eas.attestation.create"]
    },
    "workflow": {
      "inputSchema": {
        "type": "object",
        "required": ["integraHash", "tokenId", "recipient", "schemaUID", "capabilities"],
        "properties": {
          "integraHash": {
            "type": "string",
            "pattern": "^0x[a-fA-F0-9]{64}$",
            "description": "Unique identifier for the document"
          },
          "tokenId": {
            "type": "number",
            "description": "ERC-6909 token ID for the document"
          },
          "recipient": {
            "type": "string",
            "pattern": "^0x[a-fA-F0-9]{40}$",
            "description": "Address receiving the attestation"
          },
          "schemaUID": {
            "type": "string",
            "pattern": "^0x[a-fA-F0-9]{64}$",
            "description": "EAS schema UID"
          },
          "capabilities": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Array of capability strings (e.g., [\"read\", \"write\", \"share\"])"
          },
          "expirationTime": {
            "type": "number",
            "description": "Unix timestamp for expiration (0 = never expires)"
          },
          "revocable": {
            "type": "boolean",
            "description": "Whether the attestation can be revoked"
          },
          "userId": {
            "type": "string",
            "description": "User ID for tracking"
          },
          "orgDatabase": {
            "type": "string",
            "description": "Organization database name"
          }
        }
      },
      "steps": [
        {
          "id": "create-attestation",
          "name": "Create EAS Attestation",
          "type": "activity",
          "action": "message",
          "timeout": "180s",
          "retryPolicy": {
            "maximumAttempts": 3,
            "initialInterval": "5s",
            "maximumInterval": "30s",
            "backoffCoefficient": 2
          },
          "actionParams": {
            "type": "blockchain",
            "chain": "${input.chain}",
            "contractType": "eas",
            "contractVersion": "v1.3.0"
          },
          "continueOnFailure": false
        },
        {
          "id": "emit-completion",
          "name": "Emit Attestation Created Event",
          "type": "activity",
          "action": "emit",
          "actionParams": {
            "eventType": "workflow.attestation.created",
            "data": {
              "integraHash": "${input.integraHash}",
              "tokenId": "${input.tokenId}",
              "recipient": "${input.recipient}",
              "attestationUID": "${results.create-attestation.attestationUID}",
              "transactionHash": "${results.create-attestation.transactionHash}",
              "blockNumber": "${results.create-attestation.blockNumber}"
            }
          }
        }
      ]
    },
    "blockchainSchema": {
      "contract": "EAS",
      "method": "attest",
      "contractType": "eas",
      "parameters": {
        "schema": {
          "source": "input",
          "path": "schemaUID"
        },
        "data": {
          "source": "computed",
          "computation": "abi.encode([\"bytes32\", \"uint256\", \"string[]\"], [integraHash, tokenId, capabilities])"
        },
        "recipient": {
          "source": "input",
          "path": "recipient"
        },
        "expirationTime": {
          "source": "input",
          "path": "expirationTime"
        },
        "revocable": {
          "source": "input",
          "path": "revocable"
        },
        "refUID": {
          "source": "constant",
          "value": "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    },
    "outputs": {
      "attestationUID": "${results.create-attestation.attestationUID}",
      "transactionHash": "${results.create-attestation.transactionHash}",
      "blockNumber": "${results.create-attestation.blockNumber}"
    }
  }',
  '0000000000000000000000000000000000000001',
  datetime('now')
);

-- Workflow 2: Revoke Capability Attestation
INSERT INTO workflow_library (workflow_id, name, version, manifest, github_sha, synced_at)
VALUES (
  'revoke-capability-attestation',
  'Revoke Capability Attestation',
  '2.0.0',
  '{
    "id": "revoke-capability-attestation",
    "name": "Revoke Capability Attestation",
    "version": "2.0.0",
    "integraId": 1,
    "category": "attestation",
    "description": "Revokes an existing EAS attestation",
    "defaults": {
      "chain": "polygon"
    },
    "metadata": {
      "tags": ["eas", "attestation", "revocation", "access-control"],
      "tier": 2,
      "category": "attestation",
      "permissions": ["eas.attestation.revoke"]
    },
    "workflow": {
      "inputSchema": {
        "type": "object",
        "required": ["attestationUID"],
        "properties": {
          "attestationUID": {
            "type": "string",
            "pattern": "^0x[a-fA-F0-9]{64}$",
            "description": "UID of the attestation to revoke"
          },
          "userId": {
            "type": "string",
            "description": "User ID for tracking"
          },
          "orgDatabase": {
            "type": "string",
            "description": "Organization database name"
          }
        }
      },
      "steps": [
        {
          "id": "revoke-attestation",
          "name": "Revoke EAS Attestation",
          "type": "activity",
          "action": "message",
          "timeout": "180s",
          "retryPolicy": {
            "maximumAttempts": 3,
            "initialInterval": "5s",
            "maximumInterval": "30s",
            "backoffCoefficient": 2
          },
          "actionParams": {
            "type": "blockchain",
            "chain": "${input.chain}",
            "contractType": "eas",
            "contractVersion": "v1.3.0"
          },
          "continueOnFailure": false
        },
        {
          "id": "emit-completion",
          "name": "Emit Attestation Revoked Event",
          "type": "activity",
          "action": "emit",
          "actionParams": {
            "eventType": "workflow.attestation.revoked",
            "data": {
              "attestationUID": "${input.attestationUID}",
              "transactionHash": "${results.revoke-attestation.transactionHash}",
              "blockNumber": "${results.revoke-attestation.blockNumber}"
            }
          }
        }
      ]
    },
    "blockchainSchema": {
      "contract": "EAS",
      "method": "revoke",
      "contractType": "eas",
      "parameters": {
        "schema": {
          "source": "input",
          "path": "schemaUID"
        },
        "data": {
          "source": "computed",
          "computation": "abi.encode([\"bytes32\"], [attestationUID])"
        }
      }
    },
    "outputs": {
      "transactionHash": "${results.revoke-attestation.transactionHash}",
      "blockNumber": "${results.revoke-attestation.blockNumber}"
    }
  }',
  '0000000000000000000000000000000000000002',
  datetime('now')
);

-- Workflow 3: Batch Create Attestations
INSERT INTO workflow_library (workflow_id, name, version, manifest, github_sha, synced_at)
VALUES (
  'batch-create-attestations',
  'Batch Create Attestations',
  '2.0.0',
  '{
    "id": "batch-create-attestations",
    "name": "Batch Create Attestations",
    "version": "2.0.0",
    "integraId": 1,
    "category": "attestation",
    "description": "Creates multiple EAS attestations in a single transaction",
    "defaults": {
      "chain": "polygon"
    },
    "metadata": {
      "tags": ["eas", "attestation", "batch", "capability", "access-control"],
      "tier": 2,
      "category": "attestation",
      "permissions": ["eas.attestation.create"]
    },
    "workflow": {
      "inputSchema": {
        "type": "object",
        "required": ["attestations", "schemaUID"],
        "properties": {
          "attestations": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["integraHash", "tokenId", "recipient", "capabilities"],
              "properties": {
                "integraHash": {
                  "type": "string",
                  "pattern": "^0x[a-fA-F0-9]{64}$",
                  "description": "Unique identifier for the document"
                },
                "tokenId": {
                  "type": "number",
                  "description": "ERC-6909 token ID for the document"
                },
                "recipient": {
                  "type": "string",
                  "pattern": "^0x[a-fA-F0-9]{40}$",
                  "description": "Address receiving the attestation"
                },
                "capabilities": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Array of capability strings"
                }
              }
            },
            "description": "Array of attestations to create"
          },
          "schemaUID": {
            "type": "string",
            "pattern": "^0x[a-fA-F0-9]{64}$",
            "description": "EAS schema UID (same for all attestations)"
          },
          "userId": {
            "type": "string",
            "description": "User ID for tracking"
          },
          "orgDatabase": {
            "type": "string",
            "description": "Organization database name"
          }
        }
      },
      "steps": [
        {
          "id": "batch-attest",
          "name": "Batch Create EAS Attestations",
          "type": "activity",
          "action": "message",
          "timeout": "300s",
          "retryPolicy": {
            "maximumAttempts": 3,
            "initialInterval": "10s",
            "maximumInterval": "60s",
            "backoffCoefficient": 2
          },
          "actionParams": {
            "type": "blockchain",
            "chain": "${input.chain}",
            "contractType": "eas",
            "contractVersion": "v1.3.0"
          },
          "continueOnFailure": false
        },
        {
          "id": "emit-completion",
          "name": "Emit Batch Attestations Created Event",
          "type": "activity",
          "action": "emit",
          "actionParams": {
            "eventType": "workflow.attestation.batch-created",
            "data": {
              "count": "${input.attestations.length}",
              "attestationUIDs": "${results.batch-attest.attestationUIDs}",
              "transactionHash": "${results.batch-attest.transactionHash}",
              "blockNumber": "${results.batch-attest.blockNumber}"
            }
          }
        }
      ]
    },
    "blockchainSchema": {
      "contract": "EAS",
      "method": "multiAttest",
      "contractType": "eas",
      "parameters": {
        "multiAttestationRequests": {
          "source": "computed",
          "computation": "attestations.map(a => ({ schema: schemaUID, data: { recipient: a.recipient, expirationTime: 0, revocable: true, refUID: 0x0, data: abi.encode([\"bytes32\", \"uint256\", \"string[]\"], [a.integraHash, a.tokenId, a.capabilities]) } }))"
        }
      }
    },
    "outputs": {
      "attestationUIDs": "${results.batch-attest.attestationUIDs}",
      "transactionHash": "${results.batch-attest.transactionHash}",
      "blockNumber": "${results.batch-attest.blockNumber}",
      "count": "${input.attestations.length}"
    }
  }',
  '0000000000000000000000000000000000000003',
  datetime('now')
);
