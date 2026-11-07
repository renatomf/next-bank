-- migrate:up
-- The member's own requests (backoffice home plan, H1): the operator's home
-- lists what they asked, newest first, a page at a time.
CREATE INDEX requests_requester_idx
  ON operations.requests (requested_by, requested_at DESC, id DESC);

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
