-- migrate:up
-- The admin's screen of the staff (v1.3.0 plan, task 7): a member's role
-- switches between operator and analyst, and a member is disabled. The API
-- moves the role and the status, never the e-mail, the credentials nor the
-- demo flag; the application keeps an admin out of reach (G1, STF-14).
GRANT UPDATE (role, status) ON staff.members TO nextbank_app;

-- The list of the staff: newest first, page by page.
CREATE INDEX members_created_idx ON staff.members (created_at DESC, id DESC);

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
