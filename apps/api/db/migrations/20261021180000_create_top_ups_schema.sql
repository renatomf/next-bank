-- migrate:up
-- Phone top-ups (v1.1.0 plan, task 5; database.md, section 5). No foreign key
-- to accounts: contexts reference each other by id (database.md, section 1).
-- The database is the last barrier: the operators, the amounts (D6) and the
-- masked number (TOP-01) are checked here too, even if a bug gets past the
-- domain. A top-up is only ever inserted: every one completes in this
-- version (D5); a later state comes with its own migration (phase 4).

CREATE SCHEMA top_ups;
GRANT USAGE ON SCHEMA top_ups TO nextbank_app;

CREATE TABLE top_ups.top_ups (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  operator_id text NOT NULL CHECK (operator_id IN ('onda-movel', 'pulso-celular', 'rede-nova')),
  -- The number only encrypted, with its own key (decision R6), and masked.
  phone_ciphertext bytea NOT NULL,
  phone_key_version smallint NOT NULL CHECK (phone_key_version > 0),
  phone_masked text NOT NULL CHECK (phone_masked ~ '^\(\d{2}\) \*{5}-\d{4}$'),
  amount bigint NOT NULL CHECK (amount IN (1500, 2000, 3000, 5000)),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  status text NOT NULL CHECK (status IN ('COMPLETED')),
  provider_reference text NOT NULL CHECK (char_length(provider_reference) BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL
);

-- Serves the day's total for the limit (D6) and the receipt, both by account.
CREATE INDEX top_ups_account_id_created_at_idx ON top_ups.top_ups (account_id, created_at);

-- Only inserted and read (database.md, section 6).
GRANT SELECT, INSERT ON top_ups.top_ups TO nextbank_app;

-- Where the money of each operator goes: one system account per operator.
INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
VALUES
  ('01a10000-0000-7000-8000-000000000011', 'system:top-up-onda-movel', 'SYSTEM', 'BRL', now()),
  ('01a10000-0000-7000-8000-000000000012', 'system:top-up-pulso-celular', 'SYSTEM', 'BRL', now()),
  ('01a10000-0000-7000-8000-000000000013', 'system:top-up-rede-nova', 'SYSTEM', 'BRL', now());

ALTER TABLE ledger.journal_entries
  DROP CONSTRAINT journal_entries_kind_check,
  ADD CONSTRAINT journal_entries_kind_check
    CHECK (kind IN ('FUNDING', 'PIX_INTERNAL', 'TOP_UP'));

ALTER TABLE platform.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_check,
  ADD CONSTRAINT idempotency_records_operation_check
    CHECK (operation IN ('pix.create', 'pix.authorize', 'top-up.create'));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
