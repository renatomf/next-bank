-- migrate:up
-- Repeated PIN locks (threat model D7, PIX-05): the 3rd lock within 24 h blocks
-- the PIN until the client resets it with the password. The two most recent
-- lock times are enough to evaluate a sliding 24 h window.

ALTER TABLE identity.transaction_pins
  ADD COLUMN recent_locks timestamptz[] NOT NULL DEFAULT '{}',
  ADD COLUMN reset_required boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT transaction_pins_recent_locks_check CHECK (cardinality(recent_locks) <= 2),
  ADD CONSTRAINT transaction_pins_reset_required_check CHECK (
    NOT reset_required OR locked_until IS NULL
  );

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
