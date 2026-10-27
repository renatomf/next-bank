-- migrate:up
-- What the daily reconciliation asks (v1.2.0 plan, task 6): the Pix to other
-- banks completed in a day of São Paulo.
CREATE INDEX pix_transfers_external_completed_idx ON payments.pix_transfers (completed_at)
  WHERE status = 'COMPLETED' AND payee_ispb IS NOT NULL;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
