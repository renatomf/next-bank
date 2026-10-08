-- migrate:up
-- The statement reads one account's postings newest first, 20 at a time, from a
-- cursor (database.md, section 8): this index serves it without reading the
-- account's whole history, however long it gets.
CREATE INDEX postings_statement_idx
  ON ledger.postings (ledger_account_id, created_at DESC, id DESC);

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
