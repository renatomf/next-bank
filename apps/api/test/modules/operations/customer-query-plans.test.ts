import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PgAccountsRepository } from '../../../src/modules/accounts/infrastructure/pg-accounts-repository.ts';
import { PgUsersRepository } from '../../../src/modules/identity/infrastructure/pg-users-repository.ts';
import { PgRequestsRepository } from '../../../src/modules/operations/infrastructure/pg-operations-repositories.ts';
import { createPool } from '../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../helpers.ts';

// Every query behind the staff's customer reads (v1.3.0 plan, task 3) is
// served by an index, however many customers there are (CLAUDE.md, section 6).
const pool = createPool(testDatabaseUrl());

afterAll(async () => {
  await pool.end();
});

/** The plan of [sql], with sequential scans off: only whether an index can serve it. */
async function planOf(sql: string, params: unknown[]): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL enable_seqscan = off');
    const { rows } = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${sql}`, params);
    return rows.map((row) => row['QUERY PLAN']).join('\n');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

describe('the customer queries of the staff', () => {
  it.each([
    ['by ids', PgUsersRepository.FIND_CUSTOMERS_SQL, [[randomUUID()], false], 'users_pkey'],
    [
      'by e-mail',
      PgUsersRepository.FIND_CUSTOMER_BY_EMAIL_SQL,
      ['a@x.test', false],
      'users_email_key',
    ],
    [
      'by CPF',
      PgUsersRepository.FIND_CUSTOMER_BY_CPF_SQL,
      [randomBytes(32), false],
      'users_cpf_hmac_key',
    ],
    [
      'by the start of the name',
      PgUsersRepository.SEARCH_CUSTOMERS_BY_NAME_SQL,
      ['ana%', false, 21],
      'users_name_prefix_idx',
    ],
    [
      'accounts by holders',
      PgAccountsRepository.FIND_BY_HOLDERS_SQL,
      [[randomUUID()]],
      'accounts_holder_user_id_key',
    ],
    [
      'requests: the queue, a page from a position',
      PgRequestsRepository.LIST_SQL,
      ['PENDING', new Date(), false, new Date(), randomUUID(), 21, null],
      'requests_queue_idx',
    ],
    [
      "requests: the member's own, a page from a position",
      PgRequestsRepository.LIST_SQL,
      ['ALL', new Date(), false, new Date(), randomUUID(), 21, randomUUID()],
      'requests_requester_idx',
    ],
    [
      'requests: an open one for the customer',
      PgRequestsRepository.HAS_PENDING_SQL,
      [randomUUID(), 'UNBLOCK_ACCOUNT', new Date()],
      'requests_customer_idx',
    ],
    [
      'the account by number',
      PgAccountsRepository.FIND_BY_NUMBER_SQL,
      ['0001', '100000-4'],
      'accounts_branch_number_key',
    ],
  ])('finds customers %s through an index', async (_case, sql, params, index) => {
    const plan = await planOf(sql, params);

    expect(plan).toContain(index);
    expect(plan).not.toMatch(/Seq Scan/);
  });
});
