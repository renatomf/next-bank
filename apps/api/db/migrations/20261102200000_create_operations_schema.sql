-- migrate:up
-- Blocking and unblocking accounts (v1.3.0 plan, task 4). The requests that
-- need two people and their decisions, append-only (STF-10): a request is
-- never changed, its decision is a new row, one per request (STF-09), and
-- the database itself refuses a requester deciding their own (STF-03).

CREATE SCHEMA operations;
GRANT USAGE ON SCHEMA operations TO nextbank_app;

CREATE TABLE operations.requests (
  id uuid PRIMARY KEY,
  kind text NOT NULL CONSTRAINT requests_kind_check CHECK (kind IN ('UNBLOCK_ACCOUNT')),
  -- The customer (identity.users.id); contexts reference each other by id.
  customer_id uuid NOT NULL,
  reason text NOT NULL CONSTRAINT requests_reason_check
    CHECK (reason IN ('FRAUD_SUSPECTED', 'CUSTOMER_REQUEST', 'LEGAL_ORDER', 'OTHER')),
  note text CONSTRAINT requests_note_check CHECK (char_length(note) BETWEEN 1 AND 500),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  -- Derived expiry (K4): no job, no row; the request just stops being pending.
  expires_at timestamptz NOT NULL
    CONSTRAINT requests_expires_at_check CHECK (expires_at = requested_at + interval '24 hours'),
  -- A request about a demo customer: the only ones the demo staff sees (STF-11).
  demo_scope boolean NOT NULL,
  -- The decision's foreign key names the requester too, so the CHECK below
  -- compares the decider with the real requester, never one it was told.
  CONSTRAINT requests_id_requested_by_key UNIQUE (id, requested_by)
);
-- The queue: pending first, newest first, page by page.
CREATE INDEX requests_queue_idx ON operations.requests (requested_at DESC, id DESC);
-- One open request per customer and kind, checked under the account's lock.
CREATE INDEX requests_customer_idx ON operations.requests (customer_id, kind, requested_at DESC);

CREATE TABLE operations.decisions (
  request_id uuid PRIMARY KEY,
  requested_by uuid NOT NULL,
  decision text NOT NULL CONSTRAINT decisions_decision_check
    CHECK (decision IN ('APPROVED', 'REJECTED', 'CANCELLED')),
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL,
  note text CONSTRAINT decisions_note_check CHECK (char_length(note) BETWEEN 1 AND 500),
  CONSTRAINT decisions_request_fkey FOREIGN KEY (request_id, requested_by)
    REFERENCES operations.requests (id, requested_by),
  -- Whoever asked only cancels; whoever approves or rejects never asked (STF-03).
  CONSTRAINT decisions_decided_by_check CHECK (
    (decision = 'CANCELLED') = (decided_by = requested_by)
  )
);

CREATE FUNCTION operations.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE EXECUTE ON FUNCTION operations.reject_change() FROM PUBLIC;

CREATE TRIGGER requests_append_only BEFORE UPDATE OR DELETE ON operations.requests
  FOR EACH ROW EXECUTE FUNCTION operations.reject_change();
CREATE TRIGGER requests_no_truncate BEFORE TRUNCATE ON operations.requests
  FOR EACH STATEMENT EXECUTE FUNCTION operations.reject_change();
CREATE TRIGGER decisions_append_only BEFORE UPDATE OR DELETE ON operations.decisions
  FOR EACH ROW EXECUTE FUNCTION operations.reject_change();
CREATE TRIGGER decisions_no_truncate BEFORE TRUNCATE ON operations.decisions
  FOR EACH STATEMENT EXECUTE FUNCTION operations.reject_change();

GRANT SELECT, INSERT ON operations.requests, operations.decisions TO nextbank_app;
-- A decision locks its request (SELECT ... FOR UPDATE, STF-09), which Postgres
-- allows only with an UPDATE privilege: on the id alone, which the trigger
-- above keeps unchangeable like every other column.
GRANT UPDATE (id) ON operations.requests TO nextbank_app;

-- Identity: the block locks the customer out (K1). The API may now set the
-- status; a session ended by a block says so.
GRANT UPDATE (status, updated_at) ON identity.users TO nextbank_app;
ALTER TABLE identity.sessions
  DROP CONSTRAINT sessions_revoked_reason_check,
  ADD CONSTRAINT sessions_revoked_reason_check CHECK (
    (revoked_at IS NULL) = (revoked_reason IS NULL)
    AND coalesce(
      revoked_reason IN ('LOGOUT', 'REFRESH_TOKEN_REUSE', 'PASSWORD_CHANGED', 'ACCOUNT_BLOCKED'),
      true
    )
  );

-- The demo customers the demo staff never blocks: Ana and Bruno, whom every
-- visitor of the app shares (K5, STF-13). Only the seed, with the migration
-- role, marks them: the API's column grants leave this one out.
ALTER TABLE identity.users ADD COLUMN demo_protected boolean NOT NULL DEFAULT false;

-- The staff's commands are idempotent too (ADR 0015); the member is the owner.
ALTER TABLE platform.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_check,
  ADD CONSTRAINT idempotency_records_operation_check CHECK (operation IN (
    'pix.create', 'pix.authorize', 'top-up.create', 'pix.schedule',
    'staff.block', 'staff.request', 'staff.decide', 'staff.cancel'
  ));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
