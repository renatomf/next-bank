import { afterAll, describe, expect, it } from 'vitest';
import { accountNumberFrom } from '../../../src/modules/accounts/domain/account.ts';
import { createPool } from '../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../helpers.ts';
import { FixedClock } from '../../modules/identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../modules/identity/fixtures.ts';
import { pgRegisterCustomer } from './pg-register-customer-stack.ts';

// The whole registration on Postgres (domain-model.md, section 8): user,
// current account, ledger account, R$ 10.000,00 of funding and the audit
// trail, all committed together.
const pool = createPool(testDatabaseUrl());
const register = pgRegisterCustomer(pool, new FixedClock(new Date('2026-10-07T12:00:00.000Z')));

afterAll(async () => {
  await pool.end();
});

function input() {
  return {
    name: 'Maria Teste',
    email: uniqueEmail(),
    cpf: fictitiousCpf(),
    password: 'violet staple orbit 42',
    deviceLabel: 'Pixel 8',
    requestId: 'req-onboarding-1',
  };
}

interface StoredAccount {
  id: string;
  number: string;
  status: string;
  available_balance: string;
}

async function accountOf(userId: string): Promise<StoredAccount | undefined> {
  const { rows } = await pool.query<StoredAccount>(
    `SELECT a.id, a.number, a.status, l.available_balance
       FROM accounts.accounts a
       JOIN ledger.ledger_accounts l ON l.code = 'customer:' || a.id
      WHERE a.holder_user_id = $1`,
    [userId],
  );
  return rows[0];
}

describe('registration on Postgres across contexts', () => {
  it('opens a funded current account for the new customer', async () => {
    const { userId } = await register.execute(input());

    const account = await accountOf(userId);
    expect(account?.status).toBe('ACTIVE');
    expect(account?.available_balance).toBe('1000000');
    const sequence = Number(account?.number.slice(0, 6));
    expect(account?.number).toBe(accountNumberFrom(sequence));
  });

  it('records the audit trail of the user, the account and the session', async () => {
    const { userId } = await register.execute(input());
    const account = await accountOf(userId);

    const { rows } = await pool.query<{ action: string; subject_id: string }>(
      `SELECT action, subject_id FROM audit.audit_events
        WHERE actor_id = $1 ORDER BY action`,
      [userId],
    );
    expect(rows).toEqual([
      { action: 'ACCOUNT_OPENED', subject_id: account?.id },
      expect.objectContaining({ action: 'SESSION_CREATED' }),
      { action: 'USER_REGISTERED', subject_id: userId },
    ]);
  });

  // The sequence hands out numbers without a lock: no two customers share one.
  it('numbers 20 simultaneous registrations without repeating', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => register.execute(input())));

    const accounts = await Promise.all(results.map((r) => accountOf(r.userId)));
    const numbers = accounts.map((a) => a?.number);
    expect(new Set(numbers).size).toBe(20);
    expect(accounts.every((a) => a?.available_balance === '1000000')).toBe(true);
  });
});
