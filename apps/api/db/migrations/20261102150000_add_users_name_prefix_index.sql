-- migrate:up
-- The staff finds a customer by the start of the name (v1.3.0 plan, task 3):
-- text_pattern_ops lets LIKE 'ana%' use the index whatever the collation.
CREATE INDEX users_name_prefix_idx ON identity.users (lower(name) text_pattern_ops);

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
