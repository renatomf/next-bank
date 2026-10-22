-- The simulator's own role on Neon (v1.2.0 plan, task 3, S1; docs/operations.md,
-- step 10). Run ONCE on each existing branch, "clean" first and then "demo",
-- as the project owner, with psql:
--
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 \
--     -v simulator_password="..." -f infra/neon/add-simulator-role.sql
--
-- By SQL, never in the Neon console, for the reason in bootstrap.sql (ADR
-- 0009). The password comes from the developer's machine and is never
-- committed. The role reaches only the simulator schema, through the
-- simulator's own migrations.

CREATE ROLE nextbank_simulator LOGIN PASSWORD :'simulator_password';

-- No simulator transaction may hold locks for long, as for the API (API-12).
ALTER ROLE nextbank_simulator SET statement_timeout = '5s';
ALTER ROLE nextbank_simulator SET lock_timeout = '3s';
ALTER ROLE nextbank_simulator SET idle_in_transaction_session_timeout = '10s';

-- CONNECT is granted by the database owner, as in bootstrap.sql (F-28).
GRANT nextbank_migrator TO CURRENT_USER WITH SET TRUE;
SET ROLE nextbank_migrator;
GRANT CONNECT ON DATABASE nextbank TO nextbank_simulator;
RESET ROLE;
REVOKE nextbank_migrator FROM CURRENT_USER;

-- Fails the run if the grant did not take.
DO $$
BEGIN
  IF NOT has_database_privilege('nextbank_simulator', 'nextbank', 'CONNECT') THEN
    RAISE EXCEPTION 'the simulator cannot connect to nextbank (F-28)';
  END IF;
END
$$;
