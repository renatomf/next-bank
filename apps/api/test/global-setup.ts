import { execFileSync } from 'node:child_process';
import { resolveBinary } from 'dbmate';
import pg from 'pg';

// Every test run starts from an empty test database with all migrations applied,
// so integration tests always run against the schema that production gets.
// The migrator role is used only here; tests themselves connect as nextbank_app.
export default async function setup(): Promise<void> {
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url) throw new Error('TEST_MIGRATION_DATABASE_URL is not set (see .env.example)');

  await dropMigratedObjects(url);
  execFileSync(resolveBinary(), ['-e', 'TEST_MIGRATION_DATABASE_URL', '--no-dump-schema', 'up'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function dropMigratedObjects(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT quote_ident(nspname) AS name FROM pg_namespace
       WHERE nspowner = current_user::regrole AND nspname <> 'public'`,
    );
    for (const { name } of rows) await client.query(`DROP SCHEMA ${name} CASCADE`);
    await client.query('DROP TABLE IF EXISTS public.schema_migrations');
  } finally {
    await client.end();
  }
}
