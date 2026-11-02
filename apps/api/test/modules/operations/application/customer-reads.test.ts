import { beforeEach, describe, expect, it } from 'vitest';
import type { StaffReader } from '../../../../src/modules/operations/application/ports.ts';
import { GetCustomer } from '../../../../src/modules/operations/application/get-customer.ts';
import { GetCustomerStatement } from '../../../../src/modules/operations/application/get-customer-statement.ts';
import { SearchCustomers } from '../../../../src/modules/operations/application/search-customers.ts';
import { InvalidCustomerQuery } from '../../../../src/modules/operations/domain/customer-query.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, InMemoryBank, SequentialIds } from './fakes.ts';

// What the staff reads about a customer (v1.3.0 plan, task 3; STF-07): masked
// by default, every read written to the audit trail in the same transaction,
// and the demo staff seeing only the demo customers (B5, STF-11).
const NOW = new Date('2026-11-02T15:00:00.000Z');
const analyst: StaffReader = { memberId: 'analyst-1', isDemo: false, requestId: 'req-1' };
const demoOperator: StaffReader = { memberId: 'demo-op', isDemo: true, requestId: 'req-2' };

let bank: InMemoryBank;
let deps: ConstructorParameters<typeof SearchCustomers>[0];

beforeEach(() => {
  bank = new InMemoryBank();
  deps = {
    unitOfWork: bank,
    customers: bank,
    accounts: bank,
    audit: bank,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  };
  bank.addCustomer({ id: 'ana', name: 'Ana Souza', email: 'ana@example.test', isDemo: true });
  bank.addCustomer({
    id: 'visitor',
    name: 'Ana Visitante',
    email: 'v@example.test',
    isDemo: false,
  });
});

describe('SearchCustomers', () => {
  it('answers each customer masked, with the account', async () => {
    const result = await new SearchCustomers(deps).execute(analyst, 'ana@example.test');

    expect(result).toEqual({
      customers: [
        {
          id: 'ana',
          name: 'Ana Souza',
          cpfMasked: '***.444.777-**',
          emailMasked: 'a***@example.test',
          status: 'ACTIVE',
          account: { branch: '0001', number: '100000-0', status: 'ACTIVE' },
        },
      ],
      truncated: false,
    });
  });

  it('finds by the start of the name, at most 20, telling when there were more', async () => {
    for (let i = 0; i < 21; i++) {
      bank.addCustomer({
        id: `c${String(i)}`,
        name: `Carla ${String(i)}`,
        email: `c${String(i)}@x.test`,
        isDemo: false,
      });
    }

    const result = await new SearchCustomers(deps).execute(analyst, 'carla');

    expect(result.customers).toHaveLength(20);
    expect(result.truncated).toBe(true);
    // One more than the page: enough to know there is more, never the whole table.
    expect(bank.lastSearch?.limit).toBe(21);
  });

  it('finds by the account number', async () => {
    const result = await new SearchCustomers(deps).execute(analyst, '100001-0');

    expect(result.customers.map((c) => c.id)).toEqual(['visitor']);
  });

  it("never shows a visitor's registration to the demo staff (STF-11)", async () => {
    const byName = await new SearchCustomers(deps).execute(demoOperator, 'Ana');
    const byAccount = await new SearchCustomers(deps).execute(demoOperator, '100001-0');

    expect(byName.customers.map((c) => c.id)).toEqual(['ana']);
    expect(byAccount.customers).toEqual([]);
  });

  it('writes one event per search, with what kind of term and how many, never the term (C3)', async () => {
    await new SearchCustomers(deps).execute(analyst, 'ana@example.test');

    expect(bank.audit).toEqual([
      {
        id: 'id-1',
        occurredAt: NOW,
        actorType: 'STAFF',
        actorId: 'analyst-1',
        action: 'CUSTOMERS_SEARCHED',
        subjectType: 'STAFF_MEMBER',
        subjectId: 'analyst-1',
        requestId: 'req-1',
        metadata: { by: 'EMAIL', results: 1 },
      },
    ]);
    expect(JSON.stringify(bank.audit)).not.toContain('ana@example.test');
  });

  it('refuses a term too short, before reading anything', async () => {
    await expect(new SearchCustomers(deps).execute(analyst, 'an')).rejects.toThrow(
      InvalidCustomerQuery,
    );
    expect(bank.audit).toEqual([]);
  });
});

describe('GetCustomer', () => {
  it('answers the card masked, with the balance, and audits the access', async () => {
    const card = await new GetCustomer(deps).execute(analyst, 'ana');

    expect(card).toEqual({
      id: 'ana',
      name: 'Ana Souza',
      cpfMasked: '***.444.777-**',
      emailMasked: 'a***@example.test',
      status: 'ACTIVE',
      account: {
        branch: '0001',
        number: '100000-0',
        status: 'ACTIVE',
        openedAt: new Date('2026-10-01T12:00:00.000Z'),
      },
      balance: Money.of(1_000_00n),
    });
    expect(bank.audit).toEqual([
      {
        id: 'id-1',
        occurredAt: NOW,
        actorType: 'STAFF',
        actorId: 'analyst-1',
        action: 'SENSITIVE_DATA_ACCESSED',
        subjectType: 'USER',
        subjectId: 'ana',
        requestId: 'req-1',
        metadata: { view: 'CUSTOMER' },
      },
    ]);
  });

  it('answers NotFound for an unknown customer, and audits nothing', async () => {
    await expect(new GetCustomer(deps).execute(analyst, 'nobody')).rejects.toThrow(NotFound);
    expect(bank.audit).toEqual([]);
  });

  it("answers NotFound for a visitor's registration to the demo staff (STF-11)", async () => {
    await expect(new GetCustomer(deps).execute(demoOperator, 'visitor')).rejects.toThrow(NotFound);
    expect(bank.audit).toEqual([]);
  });
});

describe('GetCustomerStatement', () => {
  it("reads the customer's statement from the position given, and audits the access", async () => {
    const after = { createdAt: '2026-11-01T10:00:00.000000Z', postingId: 'p-9' };

    const page = await new GetCustomerStatement(deps).execute(analyst, 'ana', after);

    expect(page).toEqual({ items: [], next: null });
    expect(bank.statementRequests).toEqual([{ holderId: 'ana', after }]);
    expect(bank.audit.map((event) => [event.action, event.subjectId, event.metadata])).toEqual([
      ['SENSITIVE_DATA_ACCESSED', 'ana', { view: 'STATEMENT' }],
    ]);
  });

  it("never reads a visitor's statement for the demo staff (STF-11)", async () => {
    await expect(
      new GetCustomerStatement(deps).execute(demoOperator, 'visitor', null),
    ).rejects.toThrow(NotFound);
    expect(bank.statementRequests).toEqual([]);
    expect(bank.audit).toEqual([]);
  });
});
