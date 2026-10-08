import { describe, expect, it } from 'vitest';
import { CustomerLedgerAccounts } from '../../../../src/modules/ledger/application/customer-ledger-accounts.ts';
import { PostJournalEntry } from '../../../../src/modules/ledger/application/post-journal-entry.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { InMemoryLedger, tx } from './fakes.ts';

// The statement (domain-model.md 8.1): a read of the ledger only, newest first,
// 20 per page, each item with the counterparty kept in its posting.
const ANA = { name: 'Ana Souza', documentMasked: '***.444.777-**' };
const MARINA = { name: 'Marina Costa', documentMasked: '***.456.789-**' };

async function setup() {
  const ledger = new InMemoryLedger();
  const clock = new FixedClock(new Date('2026-10-08T12:00:00.000Z'));
  const ids = new SequentialIds();
  const accounts = new CustomerLedgerAccounts({
    repositories: ledger,
    clock,
    ids,
    postJournalEntry: new PostJournalEntry({ repositories: ledger, clock, ids }),
  });
  await accounts.open(tx, 'account-a');
  await accounts.open(tx, 'account-b');
  await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(1_000_000n) });
  return { clock, accounts };
}

async function pix(
  accounts: CustomerLedgerAccounts,
  transferId: string,
  cents: bigint,
  from = 'account-a',
  to = 'account-b',
) {
  await accounts.transferPix(tx, {
    transferId,
    payerAccountId: from,
    payeeAccountId: to,
    amount: Money.of(cents),
    payer: from === 'account-a' ? ANA : MARINA,
    payee: to === 'account-a' ? ANA : MARINA,
  });
}

describe('CustomerLedgerAccounts.statement', () => {
  it('shows the demo funding as money in from next bank', async () => {
    const { accounts } = await setup();

    const page = await accounts.statement(tx, 'account-a', null);

    expect(page).toEqual({
      items: [
        {
          id: expect.any(String) as string,
          occurredAt: new Date('2026-10-08T12:00:00.000Z'),
          kind: 'DEMO_FUNDING',
          direction: 'IN',
          amount: Money.of(1_000_000n),
          counterparty: { name: 'next bank', documentMasked: null },
          transferId: null,
        },
      ],
      next: null,
    });
  });

  it('shows a sent Pix as money out with its receipt, and a received one as money in', async () => {
    const { clock, accounts } = await setup();
    clock.current = new Date('2026-10-08T12:05:00.000Z');
    await pix(accounts, 'pix-1', 8_000n);

    const [sent] = (await accounts.statement(tx, 'account-a', null)).items;
    const [received] = (await accounts.statement(tx, 'account-b', null)).items;

    expect(sent).toMatchObject({
      kind: 'PIX_SENT',
      direction: 'OUT',
      amount: Money.of(8_000n),
      counterparty: MARINA,
      transferId: 'pix-1',
    });
    // The payee never reaches the payer's Pix (PIX-01): no receipt link (D3).
    expect(received).toMatchObject({
      kind: 'PIX_RECEIVED',
      direction: 'IN',
      amount: Money.of(8_000n),
      counterparty: ANA,
      transferId: null,
    });
  });

  it('lists newest first and pages by 20, with where to continue', async () => {
    const { clock, accounts } = await setup();
    for (let minute = 1; minute <= 24; minute++) {
      clock.current = new Date(Date.UTC(2026, 9, 8, 12, minute));
      await pix(accounts, `pix-${String(minute)}`, 100n);
    }

    const first = await accounts.statement(tx, 'account-a', null);
    const second = await accounts.statement(tx, 'account-a', first.next);

    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.transferId).toBe('pix-24');
    expect(first.next).not.toBeNull();
    // 24 Pix and the funding: 5 left, and nothing after them.
    expect(second.items.map((item) => item.transferId)).toEqual([
      'pix-4',
      'pix-3',
      'pix-2',
      'pix-1',
      null,
    ]);
    expect(second.next).toBeNull();
  });

  it('shows nothing of another account', async () => {
    const { accounts } = await setup();

    expect((await accounts.statement(tx, 'account-b', null)).items).toEqual([]);
  });

  it('has no statement for an account without a ledger account, a bug in the caller', async () => {
    const { accounts } = await setup();

    await expect(accounts.statement(tx, 'account-unknown', null)).rejects.toThrow(
      /account-unknown/,
    );
  });
});
