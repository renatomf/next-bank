-- migrate:up
-- The audit trail of a request (v1.3.0 plan, task 8, H5): the events that
-- cite the approval request in their metadata (a reversal, a resolution, the
-- Pix the staff ended), besides those whose subject it is. Only those events
-- carry the key, so the index stays small.
CREATE INDEX audit_events_approval_request_idx
  ON audit.audit_events ((metadata ->> 'approvalRequestId'), occurred_at DESC, id DESC)
  WHERE metadata ? 'approvalRequestId';

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
