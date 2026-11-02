// Adds a member to the backoffice's staff (v1.3.0 plan, task 1, S7) and shows
// its password and TOTP secret once: they are never stored in the clear, and
// no public route creates staff. Uses the API's role and STAFF_TOTP_KEY.
// Usage: pnpm staff:create --name "Lia Operadora" --email lia@example.com --role OPERATOR [--demo]
import { parseArgs } from 'node:util';
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

if (import.meta.main) {
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
