-- migrate:up
-- The scheduled and recurring Pix (v1.2.0 plan, task 7; D9, D10). The customer
-- authorizes with the PIN once, when scheduling; the worker in the API's
-- process pays each occurrence once, through the same processing as an
-- authorized Pix.

-- The payee is kept as the Pix keeps it, and never looked up again (S1): an
-- account of next bank, or another bank's key, encrypted, sent to the SPI.
CREATE TABLE payments.pix_schedules (
  id uuid PRIMARY KEY,
  payer_account_id uuid NOT NULL,
  payee_account_id uuid,
  payee_ispb char(8) CHECK (payee_ispb ~ '^[0-9]{8}$'),
  payee_bank_name text CHECK (char_length(payee_bank_name) BETWEEN 1 AND 80),
  payee_key_ciphertext bytea,
  payee_key_version smallint CHECK (payee_key_version > 0),
  payee_key_type text NOT NULL CHECK (payee_key_type IN ('CPF', 'EMAIL', 'PHONE', 'RANDOM')),
  payee_key_masked text NOT NULL CHECK (char_length(payee_key_masked) <= 80),
  payee_name text NOT NULL CHECK (char_length(payee_name) BETWEEN 2 AND 120),
  payee_document_masked text NOT NULL CHECK (char_length(payee_document_masked) <= 20),
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  description text CHECK (char_length(description) <= 140),
  -- Days of São Paulo, as the worker counts them.
  first_date date NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('ONCE', 'MONTHLY')),
  times smallint NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'FINISHED', 'CANCELLED')),
  next_sequence smallint,
  next_occurrence_date date,
  version bigint NOT NULL,
  created_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL,
  CONSTRAINT pix_schedules_one_payee_check
    CHECK ((payee_account_id IS NULL) <> (payee_ispb IS NULL)),
  CONSTRAINT pix_schedules_external_payee_check CHECK (
    (payee_ispb IS NULL) = (payee_bank_name IS NULL)
    AND (payee_ispb IS NULL) = (payee_key_ciphertext IS NULL)
    AND (payee_ispb IS NULL) = (payee_key_version IS NULL)
  ),
  CONSTRAINT pix_schedules_payer_payee_check CHECK (payer_account_id <> payee_account_id),
  -- S2: once is once; monthly is 2 to 24 times.
  CONSTRAINT pix_schedules_times_check CHECK (
    (frequency = 'ONCE' AND times = 1) OR (frequency = 'MONTHLY' AND times BETWEEN 2 AND 24)
  ),
  -- Written as equalities: a CHECK that evaluates to NULL passes.
  CONSTRAINT pix_schedules_next_check CHECK (
    (status = 'ACTIVE') = (next_sequence IS NOT NULL)
    AND (status = 'ACTIVE') = (next_occurrence_date IS NOT NULL)
    AND coalesce(next_sequence BETWEEN 1 AND times, true)
  ),
  CONSTRAINT pix_schedules_cancelled_check
    CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

-- What was scheduled never changes; only the schedule moves on or ends.
GRANT SELECT, INSERT ON payments.pix_schedules TO nextbank_app;
GRANT UPDATE (status, next_sequence, next_occurrence_date, cancelled_at, version, updated_at)
  ON payments.pix_schedules TO nextbank_app;

-- The worker's round: the active schedules due by a date, the oldest first.
CREATE INDEX pix_schedules_due_idx ON payments.pix_schedules (next_occurrence_date)
  WHERE status = 'ACTIVE';
-- A customer's schedules, newest first, by cursor (as the statement).
CREATE INDEX pix_schedules_payer_idx
  ON payments.pix_schedules (payer_account_id, created_at DESC, id DESC);

-- Each occurrence paid, once per date and per sequence (EXT-05), by a Pix of
-- its own; its state and failure are the Pix's, the source of truth.
CREATE TABLE payments.pix_schedule_occurrences (
  id uuid PRIMARY KEY,
  schedule_id uuid NOT NULL REFERENCES payments.pix_schedules (id),
  sequence smallint NOT NULL CHECK (sequence >= 1),
  occurrence_date date NOT NULL,
  transfer_id uuid NOT NULL REFERENCES payments.pix_transfers (id),
  executed_at timestamptz NOT NULL,
  CONSTRAINT pix_schedule_occurrences_schedule_id_occurrence_date_key
    UNIQUE (schedule_id, occurrence_date),
  CONSTRAINT pix_schedule_occurrences_schedule_id_sequence_key UNIQUE (schedule_id, sequence),
  CONSTRAINT pix_schedule_occurrences_transfer_id_key UNIQUE (transfer_id)
);

GRANT SELECT, INSERT ON payments.pix_schedule_occurrences TO nextbank_app;

-- Scheduling is a financial command: once per idempotency key (ADR 0007).
ALTER TABLE platform.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_check,
  ADD CONSTRAINT idempotency_records_operation_check
    CHECK (operation IN ('pix.create', 'pix.authorize', 'top-up.create', 'pix.schedule'));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
