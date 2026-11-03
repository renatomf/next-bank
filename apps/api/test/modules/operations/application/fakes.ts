import type {
  AuditTrailFactory,
  CustomerAccount,
  CustomerAccountsPort,
  CustomerLookup,
  CustomerRecord,
  CustomerScope,
  CustomersPort,
  StatementPage,
  StatementPosition,
} from '../../../../src/modules/operations/application/ports.ts';
import type {
  AuditEvent,
  AuditTrail,
  Transaction,
  UnitOfWork,
} from '../../../../src/shared/application/ports.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

export { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';

interface StoredCustomer extends CustomerRecord {
  isDemo: boolean;
  cpfDigits: string;
}

/**
 * Identity, Accounts and the audit trail as Operations sees them, in memory.
 * The scope works as the real queries do: a demo reader sees demo customers only.
 */
export class InMemoryBank
  implements UnitOfWork, CustomersPort, CustomerAccountsPort, AuditTrailFactory
{
  readonly customers: StoredCustomer[] = [];
  readonly accounts: CustomerAccount[] = [];
  readonly balances = new Map<string, Money>();
  readonly audit: AuditEvent[] = [];
  /** Which holder and position each statement page was asked for. */
  readonly statementRequests: { holderId: string; after: StatementPosition | null }[] = [];
  /** What the last name search asked for, limit included. */
  lastSearch: { lookup: CustomerLookup; limit: number } | null = null;
  statementPage: StatementPage = { items: [], next: null };

  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return work({ kind: 'transaction' });
  }

  addCustomer(input: {
    id: string;
    name: string;
    email: string;
    isDemo: boolean;
    demoProtected?: boolean;
  }): void {
    this.customers.push({
      ...input,
      demoProtected: input.demoProtected ?? false,
      cpfMasked: '***.444.777-**',
      cpfDigits: input.id.replace(/\D/g, '').padEnd(11, '0').slice(0, 11),
      status: 'ACTIVE',
    });
    this.accounts.push({
      holderId: input.id,
      branch: '0001',
      number: `1000${String(this.accounts.length).padStart(2, '0')}-0`,
      status: 'ACTIVE',
      openedAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    this.balances.set(input.id, Money.of(1_000_00n));
  }

  #visible(scope: CustomerScope): StoredCustomer[] {
    return this.customers.filter((customer) => !scope.onlyDemo || customer.isDemo);
  }

  find(_tx: Transaction, id: string, scope: CustomerScope): Promise<CustomerRecord | null> {
    return Promise.resolve(recordOf(this.#visible(scope).find((c) => c.id === id)));
  }

  findMany(_tx: Transaction, ids: string[], scope: CustomerScope): Promise<CustomerRecord[]> {
    return Promise.resolve(
      this.#visible(scope)
        .filter((c) => ids.includes(c.id))
        .flatMap((c) => recordOf(c) ?? []),
    );
  }

  search(
    _tx: Transaction,
    lookup: CustomerLookup,
    scope: CustomerScope,
    limit: number,
  ): Promise<CustomerRecord[]> {
    this.lastSearch = { lookup, limit };
    const matches = this.#visible(scope).filter((c) => {
      switch (lookup.by) {
        case 'CPF':
          return c.cpfDigits === lookup.cpf.digits;
        case 'EMAIL':
          return c.email === lookup.email;
        case 'NAME':
          return c.name.toLowerCase().startsWith(lookup.prefix.toLowerCase());
      }
    });
    return Promise.resolve(matches.slice(0, limit).flatMap((c) => recordOf(c) ?? []));
  }

  ofHolders(_tx: Transaction, holderIds: string[]): Promise<CustomerAccount[]> {
    return Promise.resolve(this.accounts.filter((a) => holderIds.includes(a.holderId)));
  }

  /** Here an account's id is its holder's: one account per customer. */
  holderOfAccount(_tx: Transaction, accountId: string): Promise<string | null> {
    return Promise.resolve(this.accounts.some((a) => a.holderId === accountId) ? accountId : null);
  }

  holdersOfAccounts(_tx: Transaction, accountIds: string[]): Promise<Map<string, string>> {
    return Promise.resolve(
      new Map(
        this.accounts
          .filter((a) => accountIds.includes(a.holderId))
          .map((a) => [a.holderId, a.holderId]),
      ),
    );
  }

  /** Here a customer's account id is named after its holder. */
  accountIdOf(_tx: Transaction, holderId: string): Promise<string | null> {
    return Promise.resolve(
      this.accounts.some((a) => a.holderId === holderId) ? `account-of-${holderId}` : null,
    );
  }

  holderOf(_tx: Transaction, number: string): Promise<string | null> {
    return Promise.resolve(this.accounts.find((a) => a.number === number)?.holderId ?? null);
  }

  balanceOf(_tx: Transaction, holderId: string): Promise<Money> {
    const balance = this.balances.get(holderId);
    return balance ? Promise.resolve(balance) : Promise.reject(new Error('no account'));
  }

  statementOf(
    _tx: Transaction,
    holderId: string,
    after: StatementPosition | null,
  ): Promise<StatementPage> {
    this.statementRequests.push({ holderId, after });
    return Promise.resolve(this.statementPage);
  }

  for(): AuditTrail {
    return {
      record: (event) => {
        this.audit.push(event);
        return Promise.resolve();
      },
    };
  }
}

function recordOf(customer: StoredCustomer | undefined): CustomerRecord | null {
  if (!customer) return null;
  const { id, name, cpfMasked, email, status, demoProtected } = customer;
  return { id, name, cpfMasked, email, status, demoProtected };
}
