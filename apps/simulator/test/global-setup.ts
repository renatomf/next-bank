import { execFileSync } from 'node:child_process';
import { resolveBinary } from 'dbmate';
import pg from 'pg';

// Every run starts from an empty simulator schema with all its migrations
// applied, as the API's tests do with theirs. The migrator role is used only
// here; the tests connect as nextbank_simulator.
export default async function setup(): Promise<void> {
  const url = process.env.TEST_SIMULATOR_MIGRATION_DATABASE_URL;
  if (!url) throw new Error('TEST_SIMULATOR_MIGRATION_DATABASE_URL is not set (see .env.example)');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS simulator CASCADE');
    await client.query('DROP TABLE IF EXISTS public.simulator_migrations');
  } finally {
    await client.end();
  }
  execFileSync(
    resolveBinary(),
    [
      '-e',
      'TEST_SIMULATOR_MIGRATION_DATABASE_URL',
      '--migrations-table',
      'simulator_migrations',
      '--no-dump-schema',
      'up',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}
