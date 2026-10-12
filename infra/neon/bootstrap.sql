-- Least-privilege roles and the application database on Neon (database.md,
-- section 6; ADR 0009; docs/operations.md, step 2). Run ONCE, on the root
-- branch ("clean"), as the project owner, with psql:
--
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 \
--     -v migrator_password="..." -v app_password="..." -f infra/neon/bootstrap.sql
--
-- Roles are created here by SQL, never in the Neon console: console roles join
-- neon_superuser, which bypasses every GRANT (ADR 0009, findings on Neon).
-- The passwords come from the developer's machine and are never committed.

CREATE ROLE nextbank_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE nextbank_app LOGIN PASSWORD :'app_password';

-- No API transaction may hold locks for long (API-12), as in local development.
ALTER ROLE nextbank_app SET statement_timeout = '5s';
ALTER ROLE nextbank_app SET lock_timeout = '3s';
ALTER ROLE nextbank_app SET idle_in_transaction_session_timeout = '10s';

-- Postgres 16+: the owner must be able to become the migrator to hand it the
-- database; the grant is taken back right after (ADR 0009).
GRANT nextbank_migrator TO CURRENT_USER WITH SET TRUE;
CREATE DATABASE nextbank OWNER nextbank_migrator;
REVOKE nextbank_migrator FROM CURRENT_USER;

-- Only the two roles reach the database; even the Neon owner is left out.
REVOKE ALL ON DATABASE nextbank FROM PUBLIC;
GRANT CONNECT ON DATABASE nextbank TO nextbank_app;
