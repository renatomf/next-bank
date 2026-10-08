-- migrate:up
-- Payments context (database.md, section 5.4; domain-model.md 3.4). No foreign
-- key to accounts: contexts reference each other by id (database.md, section 1).
-- Indexes for the Pix list, the expiry job, "my keys" and the cleanup job come
-- with the queries that use them (week 5 plan, Contratos).

CREATE SCHEMA payments;
GRANT USAGE ON SCHEMA payments TO nextbank_app;

-- A key value is personal sensitive data (database.md, section 2): encrypted in
-- the application, unique through a blind index, shown only masked.
CREATE TABLE payments.pix_keys (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('CPF', 'EMAIL', 'PHONE', 'RANDOM')),
  value_ciphertext bytea NOT NULL,
  value_hmac bytea NOT NULL CHECK (octet_length(value_hmac) = 32),
  value_masked text NOT NULL CHECK (char_length(value_masked) <= 80),
  key_version smallint NOT NULL CHECK (key_version > 0),
  created_at timestamptz NOT NULL,
  -- A key belongs to a single account (T-DB-07).
  CONSTRAINT pix_keys_type_value_hmac_key UNIQUE (type, value_hmac)
);

-- Keys are registered and read; changing or deleting one comes with "my keys".
GRANT SELECT, INSERT ON payments.pix_keys TO nextbank_app;

CREATE TABLE payments.pix_transfers (
  id uuid PRIMARY KEY,
  end_to_end_id text CONSTRAINT pix_transfers_end_to_end_id_format_check
    CHECK (end_to_end_id ~ '^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$'),
  payer_account_id uuid NOT NULL,
  payee_account_id uuid NOT NULL,
  -- Snapshot of the payee when the Pix was created: the receipt shows what
  -- held then, and never the payee's full CPF (domain-model.md 3.4).
  payee_key_type text NOT NULL CHECK (payee_key_type IN ('CPF', 'EMAIL', 'PHONE', 'RANDOM')),
  payee_key_masked text NOT NULL CHECK (char_length(payee_key_masked) <= 80),
  payee_name text NOT NULL CHECK (char_length(payee_name) BETWEEN 2 AND 120),
  payee_document_masked text NOT NULL CHECK (char_length(payee_document_masked) <= 20),
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  description text CHECK (char_length(description) <= 140),
  status text NOT NULL
    CHECK (status IN ('AWAITING_AUTH', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  failure_reason text,
  version bigint NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  authorized_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL,
  CONSTRAINT pix_transfers_end_to_end_id_key UNIQUE (end_to_end_id),
  CONSTRAINT pix_transfers_payer_payee_check CHECK (payer_account_id <> payee_account_id),
  CONSTRAINT pix_transfers_expires_at_check CHECK (expires_at > created_at),
  -- State coherent with its dates (T-DB-10). Written as equalities: a CHECK
  -- that evaluates to NULL passes, so no OR over nullable values.
  CONSTRAINT pix_transfers_completed_check CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CONSTRAINT pix_transfers_end_to_end_id_check CHECK ((status = 'COMPLETED') = (end_to_end_id IS NOT NULL)),
  CONSTRAINT pix_transfers_authorized_check CHECK (
    (status IN ('PROCESSING', 'COMPLETED', 'FAILED')) = (authorized_at IS NOT NULL)
  ),
  CONSTRAINT pix_transfers_failure_reason_check CHECK (
    (status = 'FAILED') = (failure_reason IS NOT NULL)
    AND coalesce(
      failure_reason IN ('INSUFFICIENT_FUNDS', 'LIMIT_EXCEEDED', 'PAYEE_UNAVAILABLE', 'ACCOUNT_BLOCKED'),
      true
    )
  )
);

-- What was asked (payer, payee, amount, description) never changes; only the state moves.
GRANT SELECT, INSERT ON payments.pix_transfers TO nextbank_app;
GRANT UPDATE (status, failure_reason, end_to_end_id, authorized_at, completed_at, version, updated_at)
  ON payments.pix_transfers TO nextbank_app;

-- One record per user and key (ADR 0007). The request hash never covers the
-- PIN (week 5 plan, D4); the response holds only what the client already saw.
CREATE TABLE payments.idempotency_records (
  user_id uuid NOT NULL,
  key uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('pix.create', 'pix.authorize')),
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  status text NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  response_status smallint,
  response_body jsonb,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT idempotency_records_pkey PRIMARY KEY (user_id, key),
  CONSTRAINT idempotency_records_response_check CHECK (
    (status = 'COMPLETED') = (response_status IS NOT NULL)
    AND (response_status IS NULL) = (response_body IS NULL)
  ),
  CONSTRAINT idempotency_records_expires_at_check CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '24 hours'
  )
);

-- DELETE only for the cleanup job of expired records (database.md, section 6).
GRANT SELECT, INSERT, DELETE ON payments.idempotency_records TO nextbank_app;
GRANT UPDATE (status, response_status, response_body) ON payments.idempotency_records TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
