-- migrate:up
-- Each account has at most one random key, the one shared in its QR Code
-- (v1.1.0 plan, task 3; D2). Concurrent "Receber" calls race on this index
-- with ON CONFLICT DO NOTHING, so one key wins and the others read it; the
-- same index serves that read, by account.
CREATE UNIQUE INDEX pix_keys_one_random_per_account
  ON payments.pix_keys (account_id) WHERE type = 'RANDOM';

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
