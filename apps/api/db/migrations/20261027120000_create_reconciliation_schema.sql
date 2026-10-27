-- migrate:up
-- The daily reconciliation (v1.2.0 plan, task 6; EXT-04): the SPI's
-- settlement file of a day against next bank's Pix and ledger. Its own
-- bounded context, so its own schema; it only reads the others, through
-- their modules.

CREATE SCHEMA reconciliation;
GRANT USAGE ON SCHEMA reconciliation TO nextbank_app;

-- One run per day of São Paulo: inserting it reserves the day, so two
-- instances never reconcile the same day at once; a run left RUNNING by an
-- instance that died is taken again later.
CREATE TABLE reconciliation.runs (
  run_date date PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('RUNNING', 'DONE')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  payments_checked integer CHECK (payments_checked >= 0),
  exceptions_found integer CHECK (exceptions_found >= 0),
  CONSTRAINT runs_finished_check CHECK (
    (status = 'DONE') = (finished_at IS NOT NULL)
    AND (status = 'DONE') = (payments_checked IS NOT NULL)
    AND (status = 'DONE') = (exceptions_found IS NOT NULL)
  )
);

-- What a run found. Recorded once per day, kind and Pix, so running a day
-- again adds nothing; a clearing mismatch has no Pix, and NULLS NOT DISTINCT
-- keeps it once too. Only ids and amounts: never a name or a key (API-04).
CREATE TABLE reconciliation.exceptions (
  id uuid PRIMARY KEY,
  run_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'MISSING_HERE', 'MISSING_AT_SPI', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH',
    'STALE_PROCESSING', 'CLEARING_MISMATCH'
  )),
  end_to_end_id text CHECK (end_to_end_id ~ '^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$'),
  expected_cents bigint,
  actual_cents bigint,
  detected_at timestamptz NOT NULL,
  CONSTRAINT exceptions_run_date_kind_end_to_end_id_key
    UNIQUE NULLS NOT DISTINCT (run_date, kind, end_to_end_id)
);

-- A run only moves forward; an exception is never changed nor deleted by the
-- API (R5): resolving one is the backoffice's record, in v1.3.0.
GRANT SELECT, INSERT ON reconciliation.runs TO nextbank_app;
GRANT UPDATE (status, started_at, finished_at, payments_checked, exceptions_found)
  ON reconciliation.runs TO nextbank_app;
GRANT SELECT, INSERT ON reconciliation.exceptions TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
