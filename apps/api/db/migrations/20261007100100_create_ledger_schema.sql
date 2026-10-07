-- migrate:up
-- Double-entry ledger (ADR 0005; database.md, section 5.3). The database is the
-- last barrier: every invariant is also enforced in the domain, and here it
-- holds even if a bug gets past the code.

CREATE SCHEMA ledger;
GRANT USAGE ON SCHEMA ledger TO nextbank_app;

CREATE TABLE ledger.ledger_accounts (
  id uuid PRIMARY KEY,
  code text NOT NULL CONSTRAINT ledger_accounts_code_key UNIQUE
    CHECK (code ~ '^(customer|system):[a-z0-9_-]{1,64}$'),
  kind text NOT NULL CHECK (kind IN ('CUSTOMER', 'SYSTEM')),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  posted_balance bigint NOT NULL DEFAULT 0,
  available_balance bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL,
  CONSTRAINT ledger_accounts_code_kind_check CHECK ((kind = 'CUSTOMER') = (code LIKE 'customer:%')),
  -- A customer never goes negative (T-DB-01), and holds never create money.
  CONSTRAINT ledger_accounts_available_check CHECK (kind = 'SYSTEM' OR available_balance >= 0),
  CONSTRAINT ledger_accounts_reserve_check CHECK (
    kind = 'SYSTEM' OR available_balance <= posted_balance
  ),
  -- System accounts take part in every operation of their kind: materializing
  -- their balance would make them a hot account. Their balance is the sum of
  -- their postings, computed by the reconciliation.
  CONSTRAINT ledger_accounts_system_balance_check CHECK (
    kind = 'CUSTOMER' OR (posted_balance = 0 AND available_balance = 0)
  )
);

-- Origin of the demo balance (domain-model.md, section 5; decision D3).
INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
VALUES ('01a10000-0000-7000-8000-000000000001', 'system:funding', 'SYSTEM', 'BRL', now());

CREATE TABLE ledger.journal_entries (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('FUNDING', 'PIX_INTERNAL')),
  reference_type text NOT NULL CHECK (reference_type ~ '^[A-Z][A-Z_]{2,31}$'),
  reference_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  -- A second idempotency layer, independent of the client's key (T-DB-05).
  CONSTRAINT journal_entries_reference_type_reference_id_kind_key
    UNIQUE (reference_type, reference_id, kind)
);

CREATE TABLE ledger.postings (
  id uuid PRIMARY KEY,
  journal_entry_id uuid NOT NULL REFERENCES ledger.journal_entries (id),
  ledger_account_id uuid NOT NULL REFERENCES ledger.ledger_accounts (id),
  direction char(1) NOT NULL CHECK (direction IN ('D', 'C')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL CHECK (currency = 'BRL'),
  -- Snapshot of who is on the other side, so the statement reads only the ledger.
  counterparty_name text CHECK (char_length(counterparty_name) <= 120),
  counterparty_document_masked text CHECK (char_length(counterparty_document_masked) <= 20),
  created_at timestamptz NOT NULL
);
-- Serves the balance check below, which sums the postings of one entry.
CREATE INDEX postings_journal_entry_idx ON ledger.postings (journal_entry_id);

-- At COMMIT, every entry touched in the transaction has at least two
-- postings, debits equal to credits and one currency (T-DB-02). Deferred, so
-- the postings can be inserted one at a time.
CREATE FUNCTION ledger.check_entry_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  entry_id uuid;
  postings_count int;
  debits numeric;
  credits numeric;
  currencies int;
BEGIN
  IF TG_TABLE_NAME = 'postings' THEN
    entry_id := NEW.journal_entry_id;
  ELSE
    entry_id := NEW.id;
  END IF;

  SELECT count(*),
         coalesce(sum(amount) FILTER (WHERE direction = 'D'), 0),
         coalesce(sum(amount) FILTER (WHERE direction = 'C'), 0),
         count(DISTINCT currency)
    INTO postings_count, debits, credits, currencies
    FROM ledger.postings
   WHERE journal_entry_id = entry_id;

  IF postings_count < 2 OR debits <> credits OR currencies <> 1 THEN
    RAISE EXCEPTION 'journal entry % is unbalanced', entry_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION ledger.check_entry_balanced() FROM PUBLIC;

CREATE CONSTRAINT TRIGGER postings_balanced
  AFTER INSERT ON ledger.postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.check_entry_balanced();
-- Without this one, an entry with no postings would never be checked (T-DB-02b).
CREATE CONSTRAINT TRIGGER journal_entries_balanced
  AFTER INSERT ON ledger.journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.check_entry_balanced();

-- History is append-only, enforced twice (API-05, T-DB-03): the API role has
-- no privilege to change it, and a trigger refuses even the owner. A wrong
-- entry is corrected only by a reversal entry.
CREATE FUNCTION ledger.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE EXECUTE ON FUNCTION ledger.reject_change() FROM PUBLIC;

CREATE TRIGGER journal_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger.journal_entries
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER journal_entries_no_truncate
  BEFORE TRUNCATE ON ledger.journal_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER postings_append_only
  BEFORE UPDATE OR DELETE ON ledger.postings
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER postings_no_truncate
  BEFORE TRUNCATE ON ledger.postings
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();

-- Least privilege (database.md, section 6): balances change only through the
-- API's posting, and history is read and inserted, never changed.
GRANT SELECT, INSERT ON ledger.ledger_accounts TO nextbank_app;
GRANT UPDATE (posted_balance, available_balance, version) ON ledger.ledger_accounts
  TO nextbank_app;
GRANT SELECT, INSERT ON ledger.journal_entries, ledger.postings TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
