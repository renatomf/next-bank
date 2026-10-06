#!/bin/sh
# Least-privilege roles (database.md, section 6). Runs only when the volume is created.
# nextbank_migrator: owns the databases, applies migrations (DDL).
# nextbank_app: used by the API; gets privileges only through migrations.
# nextbank_test: integration test database, with the same rules.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v migrator_password="$NEXTBANK_MIGRATOR_PASSWORD" \
  -v app_password="$NEXTBANK_APP_PASSWORD" <<'SQL'
CREATE ROLE nextbank_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE nextbank_app LOGIN PASSWORD :'app_password';
-- No API transaction may hold locks for long (API-12).
ALTER ROLE nextbank_app SET statement_timeout = '5s';
ALTER ROLE nextbank_app SET lock_timeout = '3s';
ALTER ROLE nextbank_app SET idle_in_transaction_session_timeout = '10s';

CREATE DATABASE nextbank_test;
ALTER DATABASE nextbank OWNER TO nextbank_migrator;
ALTER DATABASE nextbank_test OWNER TO nextbank_migrator;
REVOKE ALL ON DATABASE nextbank, nextbank_test FROM PUBLIC;
GRANT CONNECT ON DATABASE nextbank, nextbank_test TO nextbank_app;
SQL
