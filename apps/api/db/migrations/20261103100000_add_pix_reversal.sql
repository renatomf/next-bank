-- migrate:up
-- The two-person Pix reversal (v1.3.0 plan, task 5; B7). The ledger stays
-- append-only: a reversal is a new entry referencing the Pix, and the
-- (reference_type, reference_id, kind) key already keeps it to one per Pix.
ALTER TABLE ledger.journal_entries
  DROP CONSTRAINT journal_entries_kind_check,
  ADD CONSTRAINT journal_entries_kind_check CHECK (kind IN (
    'FUNDING', 'PIX_INTERNAL', 'TOP_UP', 'PIX_EXTERNAL',
    'PIX_EXTERNAL_SETTLEMENT', 'PIX_EXTERNAL_REFUND', 'PIX_REVERSAL'
  ));

-- A reversal request names its Pix; an unblock names none.
ALTER TABLE operations.requests
  DROP CONSTRAINT requests_kind_check,
  ADD CONSTRAINT requests_kind_check CHECK (kind IN ('UNBLOCK_ACCOUNT', 'REVERSE_PIX')),
  ADD COLUMN transfer_id uuid,
  ADD CONSTRAINT requests_transfer_id_check CHECK ((kind = 'REVERSE_PIX') = (transfer_id IS NOT NULL));

-- One open reversal per Pix, checked under the payer's account lock.
CREATE INDEX requests_transfer_idx ON operations.requests (transfer_id, requested_at DESC)
  WHERE transfer_id IS NOT NULL;

ALTER TABLE platform.idempotency_records
  DROP CONSTRAINT idempotency_records_operation_check,
  ADD CONSTRAINT idempotency_records_operation_check CHECK (operation IN (
    'pix.create', 'pix.authorize', 'top-up.create', 'pix.schedule',
    'staff.block', 'staff.request', 'staff.decide', 'staff.cancel', 'staff.reversal'
  ));

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
