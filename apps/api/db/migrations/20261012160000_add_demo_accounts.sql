-- migrate:up
-- Demo accounts are shared by every visitor of the public demo (DEMO-03): they
-- cannot change the password or the PIN, nor end the other sessions. Only the
-- demo seed, with the migration role, marks an account as demo.
ALTER TABLE identity.users ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

-- The API writes only the columns it needs, so it can never mark or unmark a
-- demo account: registration inserts a user, the password change updates its hash.
REVOKE INSERT, UPDATE ON identity.users FROM nextbank_app;
GRANT INSERT (id, name, cpf_ciphertext, cpf_hmac, cpf_masked, cpf_key_version, email,
              password_hash, status, created_at, updated_at)
  ON identity.users TO nextbank_app;
GRANT UPDATE (password_hash) ON identity.users TO nextbank_app;

-- migrate:down
-- Forward only (database.md, section 9): fix with a new migration instead.
DO $$ BEGIN RAISE EXCEPTION 'forward-only migration: write a new one'; END $$;
