-- migrate:up
-- Last barrier for refresh token rotation (AUTH-03): a session never has two
-- tokens that can be refreshed, whatever the code does. The partial index also
-- serves the lookup of a session's active token.
CREATE UNIQUE INDEX refresh_tokens_one_active_per_session
  ON identity.refresh_tokens (session_id) WHERE replaced_at IS NULL;

-- Rotation marks the old token as replaced by a successor inserted right after,
-- in the same transaction: the reference is checked at commit, so the old token
-- is never left pointing to a token that does not exist.
ALTER TABLE identity.refresh_tokens
  ALTER CONSTRAINT refresh_tokens_replaced_by_id_fkey DEFERRABLE INITIALLY DEFERRED;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
