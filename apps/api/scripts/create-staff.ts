// Adds a member to the backoffice's staff (v1.3.0 plan, task 1, S7) and shows
// its password and TOTP secret once: they are never stored in the clear, and
// no public route creates staff. Uses the API's role and STAFF_TOTP_KEY.
// Usage: pnpm staff:create --name "Lia Operadora" --email lia@example.com --role OPERATOR [--demo]
// The demo's reset: pnpm staff:create --reset (MIGRATION_DATABASE_URL,
// STAFF_TOTP_KEY and the STAFF_ADMIN_* secrets) recreates the admin and the
// demo staff of the README.
import { parseArgs } from 'node:util';
import { Secret } from 'otpauth';
import type pg from 'pg';
import { Argon2idHasher, RandomRefreshTokens } from '../src/modules/identity/index.ts';
import { createStaffModule, type StaffRole } from '../src/modules/staff/index.ts';
import type { Clock } from '../src/shared/application/ports.ts';
import { loadConfig } from '../src/shared/config.ts';
import { createPool } from '../src/shared/db.ts';
import { PgUnitOfWork } from '../src/shared/infrastructure/pg-unit-of-work.ts';
import { SystemClock, UuidV7Generator } from '../src/shared/infrastructure/system-ports.ts';

/** The creation of members, as the API composes it; the tests use it too. */
export function staffCreator(deps: { pool: pg.Pool; totpKey: Uint8Array; clock?: Clock }) {
  return createStaffModule({
    unitOfWork: new PgUnitOfWork(deps.pool),
    clock: deps.clock ?? new SystemClock(),
    ids: new UuidV7Generator(),
    totpKey: deps.totpKey,
    hasher: new Argon2idHasher(),
    tokens: new RandomRefreshTokens(),
  }).createMember;
}

/**
 * The staff of the public demo (v1.3.0 plan, B5 and task 3, C5): an operator
 * and an analyst whose password and authenticator secret are published in
 * the README, as Ana's and Bruno's are. Public on purpose: they read only
 * the demo customers, a scope the server keeps (STF-11). The authenticator
 * secrets come from a phrase, so no secret-looking literal sits in the code.
 */
export const DEMO_STAFF = [
  {
    name: 'Olívia (operadora demo)',
    email: 'olivia.demo@example.com',
    role: 'OPERATOR',
    password: 'demo-olivia-next-bank',
    totpSecret: Secret.fromLatin1('olivia demo next bank').base32,
  },
  {
    name: 'Diogo (analista demo)',
    email: 'diogo.demo@example.com',
    role: 'ANALYST',
    password: 'demo-diogo-next-bank',
    totpSecret: Secret.fromLatin1('diogo demo next bank').base32,
  },
] as const;

/** Creates the demo staff, as the reset does after the migrations. */
export async function seedDemoStaff(creator: ReturnType<typeof staffCreator>): Promise<void> {
  for (const { password, totpSecret, ...member } of DEMO_STAFF) {
    await creator.execute({ ...member, isDemo: true, credentials: { password, totpSecret } });
  }
}

/**
 * The admin of the published demo, recreated after every reset with the
 * credentials kept in the deploy's secrets (v1.3.0 plan, task 2, D4): the
 * same admin, with the same authenticator, every day. Prints nothing.
 */
async function seedStaffForReset(): Promise<void> {
  const env = {
    databaseUrl: process.env.MIGRATION_DATABASE_URL,
    totpKey: process.env.STAFF_TOTP_KEY,
    email: process.env.STAFF_ADMIN_EMAIL,
    password: process.env.STAFF_ADMIN_PASSWORD,
    totpSecret: process.env.STAFF_ADMIN_TOTP_SECRET,
  };
  for (const [name, value] of Object.entries(env)) {
    if (!value) throw new Error(`${name} is not set for the admin of the reset`);
  }
  const pool = createPool(env.databaseUrl ?? '');
  try {
    const creator = staffCreator({ pool, totpKey: Buffer.from(env.totpKey ?? '', 'base64') });
    await seedDemoStaff(creator);
    await creator.execute({
      name: 'Admin next bank',
      email: env.email ?? '',
      role: 'ADMIN',
      isDemo: false,
      credentials: { password: env.password ?? '', totpSecret: env.totpSecret ?? '' },
    });
  } finally {
    await pool.end();
  }
}

if (import.meta.main && process.argv.includes('--reset')) {
  await seedStaffForReset();
} else if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      demo: { type: 'boolean', default: false },
    },
  });
  if (!values.name || !values.email || !values.role) {
    throw new Error('usage: create-staff.ts --name <name> --email <e-mail> --role <role> [--demo]');
  }
  const config = loadConfig(process.env);
  if (!config.backoffice) throw new Error('BACKOFFICE_API_KEY and STAFF_TOTP_KEY are not set');
  const pool = createPool(config.databaseUrl);
  try {
    const created = await staffCreator({ pool, totpKey: config.backoffice.totpKey }).execute({
      name: values.name,
      email: values.email,
      role: values.role as StaffRole,
      isDemo: values.demo,
    });
    // Shown once, on this terminal only: the database keeps neither in the clear.
    process.stdout.write(
      [
        `Member ${created.email} (${created.id})`,
        `Password:    ${created.password}`,
        `TOTP secret: ${created.totpSecret}  (type it in the authenticator app)`,
        `TOTP link:   ${created.totpUri}`,
        '',
      ].join('\n'),
    );
  } finally {
    await pool.end();
  }
}
