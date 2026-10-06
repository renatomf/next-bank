import { Writable } from 'node:stream';

export function testDatabaseUrl(): string {
  return requiredEnv('TEST_DATABASE_URL');
}

/** Migrator role on the test database: only for setup and defense-in-depth tests. */
export function testMigrationDatabaseUrl(): string {
  return requiredEnv('TEST_MIGRATION_DATABASE_URL');
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

/** Captures JSON log lines for inspection in tests. */
export function captureLogs(): {
  stream: Writable;
  lines: () => Record<string, unknown>[];
  raw: () => string;
} {
  let raw = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      raw += chunk.toString();
      done();
    },
  });
  return {
    stream,
    raw: () => raw,
    lines: () =>
      raw
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}
