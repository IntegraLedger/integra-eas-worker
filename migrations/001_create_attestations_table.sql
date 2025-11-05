-- Migration: Create attestations table
-- Target: All ORG_DB_* databases
-- Version: V6.0.0

CREATE TABLE IF NOT EXISTS attestations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- EAS Attestation Identifiers
  attestation_uid TEXT NOT NULL UNIQUE,
  schema_uid TEXT NOT NULL,

  -- Document Association (Optional)
  integra_hash TEXT,
  token_id INTEGER,

  -- Attestation Classification
  attestation_type TEXT NOT NULL,
  relates_to TEXT NOT NULL,

  -- Blockchain Information
  chain TEXT NOT NULL,
  chain_id INTEGER NOT NULL,

  -- Attestation Parties
  attester TEXT NOT NULL,
  recipient TEXT NOT NULL,

  -- Attestation Data (Unencrypted)
  attestation_data TEXT NOT NULL,
  decoded_data TEXT,

  -- Attestation Metadata
  ref_uid TEXT,
  expiration_time INTEGER,
  revocation_time INTEGER DEFAULT 0,
  is_revoked INTEGER DEFAULT 0,

  -- Timestamps
  date_of_issue INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Transaction Information
  transaction_hash TEXT,
  block_number INTEGER,

  -- User Context
  direction TEXT NOT NULL,
  notes TEXT,

  -- Constraints
  CHECK (attestation_type IN ('document', 'individual', 'organization')),
  CHECK (chain IN ('ethereum', 'polygon')),
  CHECK (direction IN ('sent', 'received')),
  CHECK (is_revoked IN (0, 1)),
  CHECK (chain_id IN (1, 137))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attestations_uid ON attestations(attestation_uid);
CREATE INDEX IF NOT EXISTS idx_attestations_integra_hash ON attestations(integra_hash) WHERE integra_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attestations_recipient ON attestations(recipient);
CREATE INDEX IF NOT EXISTS idx_attestations_attester ON attestations(attester);
CREATE INDEX IF NOT EXISTS idx_attestations_direction ON attestations(direction);
CREATE INDEX IF NOT EXISTS idx_attestations_type ON attestations(attestation_type);
CREATE INDEX IF NOT EXISTS idx_attestations_chain ON attestations(chain);
CREATE INDEX IF NOT EXISTS idx_attestations_revoked ON attestations(is_revoked) WHERE is_revoked = 0;
CREATE INDEX IF NOT EXISTS idx_attestations_date ON attestations(date_of_issue DESC);
CREATE INDEX IF NOT EXISTS idx_attestations_relates_to ON attestations(relates_to);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attestations_document_type ON attestations(integra_hash, attestation_type) WHERE integra_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attestations_recipient_active ON attestations(recipient, is_revoked, date_of_issue DESC) WHERE is_revoked = 0;
