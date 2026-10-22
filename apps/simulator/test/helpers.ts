import pg from 'pg';

/** The simulator's own role on the test database. */
export function testDatabaseUrl(): string {
  return requiredEnv('TEST_SIMULATOR_DATABASE_URL');
}

/** The migrator role on the test database: only for setup and privilege tests. */
export function testMigrationDatabaseUrl(): string {
  return requiredEnv('TEST_SIMULATOR_MIGRATION_DATABASE_URL');
}

export function testPool(url: string = testDatabaseUrl()): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 10 });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}
