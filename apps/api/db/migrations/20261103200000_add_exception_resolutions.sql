-- migrate:up
-- The reconciliation's exceptions resolved by the staff (v1.3.0 plan, task 6;
-- ADR 0018, D7). An exception never changes (R5): its resolution is a row of
-- its own, one per exception, append-only like the requests.

CREATE FUNCTION reconciliation.reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE EXECUTE ON FUNCTION reconciliation.reject_change() FROM PUBLIC;

-- R5 by the database itself, not only by the API's grants.
CREATE TRIGGER exceptions_append_only BEFORE UPDATE OR DELETE ON reconciliation.exceptions
  FOR EACH ROW EXECUTE FUNCTION reconciliation.reject_change();
CREATE TRIGGER exceptions_no_truncate BEFORE TRUNCATE ON reconciliation.exceptions
  FOR EACH STATEMENT EXECUTE FUNCTION reconciliation.reject_change();
-- Resolving an exception locks it (SELECT ... FOR UPDATE), so a request and an
-- explanation never cross; Postgres allows that only with an UPDATE
-- privilege: on the id alone, which the trigger above keeps unchangeable.
GRANT UPDATE (id) ON reconciliation.exceptions TO nextbank_app;

-- The queue: newest first, page by page.
CREATE INDEX exceptions_queue_idx ON reconciliation.exceptions (detected_at DESC, id DESC);

-- A Pix left waiting is settled or refunded by an approved request (X1, X3);
-- any exception is explained, with its text and no request (X2). The text
-- stays here, never in the audit trail (API-04).
CREATE TABLE reconciliation.resolutions (
  exception_id uuid PRIMARY KEY
    CONSTRAINT resolutions_exception_id_fkey REFERENCES reconciliation.exceptions (id),
  outcome text NOT NULL CONSTRAINT resolutions_outcome_value_check
    CHECK (outcome IN ('SETTLED', 'REFUNDED', 'EXPLAINED')),
  -- The approval request (operations.requests.id); contexts reference each other by id.
  approval_request_id uuid,
  explanation text CONSTRAINT resolutions_explanation_check
    CHECK (char_length(explanation) BETWEEN 10 AND 500),
  resolved_by uuid NOT NULL,
  resolved_at timestamptz NOT NULL,
  CONSTRAINT resolutions_outcome_check CHECK (
    (outcome = 'EXPLAINED') = (explanation IS NOT NULL)
    AND (outcome = 'EXPLAINED') = (approval_request_id IS NULL)
  )
);

CREATE TRIGGER resolutions_append_only BEFORE UPDATE OR DELETE ON reconciliation.resolutions
  FOR EACH ROW EXECUTE FUNCTION reconciliation.reject_change();
CREATE TRIGGER resolutions_no_truncate BEFORE TRUNCATE ON reconciliation.resolutions
  FOR EACH STATEMENT EXECUTE FUNCTION reconciliation.reject_change();
GRANT SELECT, INSERT ON reconciliation.resolutions TO nextbank_app;

-- A request to settle or refund names its exception and how; nothing else does.
ALTER TABLE operations.requests
  DROP CONSTRAINT requests_kind_check,
  ADD CONSTRAINT requests_kind_check
    CHECK (kind IN ('UNBLOCK_ACCOUNT', 'REVERSE_PIX', 'RESOLVE_EXCEPTION')),
  ADD COLUMN exception_id uuid,
  ADD COLUMN resolution text CONSTRAINT requests_resolution_check
    CHECK (resolution IN ('SETTLE', 'REFUND')),
  ADD CONSTRAINT requests_exception_id_check CHECK (
    (kind = 'RESOLVE_EXCEPTION') = (exception_id IS NOT NULL)
    AND (exception_id IS NULL) = (resolution IS NULL)
  );

-- One pending request per exception, checked under the exception's lock.
CREATE INDEX requests_exception_idx ON operations.requests (exception_id, requested_at DESC)
  WHERE exception_id IS NOT NULL;

ALTER TABLE platform.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_check,
  ADD CONSTRAINT idempotency_records_operation_check CHECK (operation IN (
    'pix.create', 'pix.authorize', 'top-up.create', 'pix.schedule',
    'staff.block', 'staff.request', 'staff.decide', 'staff.cancel', 'staff.reversal',
    'staff.exception', 'staff.explain'
  ));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
