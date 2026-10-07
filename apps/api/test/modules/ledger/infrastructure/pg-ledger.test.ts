import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import {
  SystemClock,
  UuidV7Generator,
} from '../../../../src/shared/infrastructure/system-ports.ts';
import { InsufficientFunds } from '../../../../src/modules/ledger/domain/errors.ts';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import { testDatabaseUrl } from '../../../helpers.ts';

// The ledger against the real schema, the API role and real concurrency
// (database.md, sections 7 and 11; ADR 0007).
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);
const ledger = createLedgerModule({ clock: new SystemClock(), ids: new UuidV7Generator() });

afterAll(async () => {
  await pool.end();
});

/** A current account id with its ledger account, funded with [cents]. */
async function customer(cents: bigint): Promise<{ accountId: string; ledgerId: string }> {
  const accountId = randomUUID();
  await unitOfWork.run(async (tx) => {
    await ledger.customerAccounts.open(tx, accountId);
    if (cents > 0n) {
      await ledger.customerAccounts.fund(tx, { accountId, amount: Money.of(cents) });
    }
  });
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM ledger.ledger_accounts WHERE code = $1',
    [`customer:${accountId}`],
  );
  return { accountId, ledgerId: rows[0]?.id ?? '' };
}

/** An internal transfer, as the Pix will post it (week 5). */
function transfer(from: string, to: string, cents: bigint): Promise<string> {
  return unitOfWork.run((tx) =>
    ledger.postJournalEntry.execute(tx, {
      kind: 'PIX_INTERNAL',
      referenceType: 'PIX_TRANSFER',
      referenceId: randomUUID(),
      postings: [
        {
          ledgerAccountId: from,
          direction: 'DEBIT',
          amount: Money.of(cents),
          counterpartyName: 'Bruno Teste',
          counterpartyDocumentMasked: null,
        },
        {
          ledgerAccountId: to,
          direction: 'CREDIT',
          amount: Money.of(cents),
          counterpartyName: 'Ana Teste',
          counterpartyDocumentMasked: null,
        },
      ],
    }),
  );
}

function balanceOf(accountId: string): Promise<Money | null> {
  return unitOfWork.run((tx) => ledger.customerAccounts.availableBalance(tx, accountId));
}

/** The materialized balance must equal the sum of the postings (reconciliation, T-DB-14). */
async function reconciles(ledgerId: string): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT a.posted_balance = coalesce(sum(CASE p.direction WHEN 'C' THEN p.amount
                                                 ELSE -p.amount END), 0) AS ok
       FROM ledger.ledger_accounts a
       LEFT JOIN ledger.postings p ON p.ledger_account_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [ledgerId],
  );
  return rows[0]?.ok ?? false;
}

describe('ledger on Postgres', () => {
  it('opens and funds a customer account in one transaction', async () => {
    const { accountId, ledgerId } = await customer(1_000_000n);

    expect(await balanceOf(accountId)).toEqual(Money.of(1_000_000n));
    expect(await reconciles(ledgerId)).toBe(true);
  });

  it('funds an account only once: a second funding rolls back (T-DB-05)', async () => {
    const { accountId } = await customer(1_000_000n);

    await expect(
      unitOfWork.run((tx) =>
        ledger.customerAccounts.fund(tx, { accountId, amount: Money.of(1_000_000n) }),
      ),
    ).rejects.toThrow(/journal_entries_reference_type_reference_id_kind_key/);
    expect(await balanceOf(accountId)).toEqual(Money.of(1_000_000n));
  });

  // PIX-03: two requests racing for the same balance.
  it('spends a balance once under concurrency: 2 × R$ 80 over R$ 100 (T-DB-08)', async () => {
    const payer = await customer(10_000n);
    const payee = await customer(0n);

    const results = await Promise.allSettled([
      transfer(payer.ledgerId, payee.ledgerId, 8_000n),
      transfer(payer.ledgerId, payee.ledgerId, 8_000n),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((r) => r.status === 'rejected');
    expect(refused?.reason).toBeInstanceOf(InsufficientFunds);
    expect(await balanceOf(payer.accountId)).toEqual(Money.of(2_000n));
    expect(await balanceOf(payee.accountId)).toEqual(Money.of(8_000n));
    expect(await reconciles(payer.ledgerId)).toBe(true);
    expect(await reconciles(payee.ledgerId)).toBe(true);
  });

  // Locks taken in id order: A→B and B→A never wait on each other in a cycle.
  it('never deadlocks: 50 A→B and 50 B→A at once (T-DB-09)', async () => {
    const a = await customer(10_000n);
    const b = await customer(10_000n);

    const transfers = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? transfer(a.ledgerId, b.ledgerId, 100n) : transfer(b.ledgerId, a.ledgerId, 100n),
    );
    const results = await Promise.allSettled(transfers);

    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(await balanceOf(a.accountId)).toEqual(Money.of(10_000n));
    expect(await balanceOf(b.accountId)).toEqual(Money.of(10_000n));
    expect(await reconciles(a.ledgerId)).toBe(true);
    expect(await reconciles(b.ledgerId)).toBe(true);
  });
});
