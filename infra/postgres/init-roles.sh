#!/bin/sh
# Papéis de menor privilégio (database.md, seção 6). Roda só na criação do volume.
# nextbank_migrator: dono do banco, aplica as migrations (DDL).
# nextbank_app: usado pela API; recebe permissões apenas pelas migrations.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v migrator_password="$NEXTBANK_MIGRATOR_PASSWORD" \
  -v app_password="$NEXTBANK_APP_PASSWORD" <<'SQL'
CREATE ROLE nextbank_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE nextbank_app LOGIN PASSWORD :'app_password';
ALTER DATABASE nextbank OWNER TO nextbank_migrator;
REVOKE ALL ON DATABASE nextbank FROM PUBLIC;
GRANT CONNECT ON DATABASE nextbank TO nextbank_app;
SQL
