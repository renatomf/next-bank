import type {
  ClaimResult,
  IdempotencyClaim,
  IdempotencyRepository,
  StoredResponse,
} from '../../../../src/shared/application/idempotency.ts';
import type {
  AuditEvent,
  AuditTrail,
  Transaction,
} from '../../../../src/shared/application/ports.ts';
import { DomainError } from '../../../../src/shared/domain/domain-error.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import type {
  AccountsPort,
  IdentityPort,
  LedgerPort,
  PhoneProtector,
  PinCheck,
  ProtectedPhone,
  TopUpAccount,
  TopUpPosting,
  TopUpProvider,
  TopUpRequest,
  TopUpState,
  TopUpsRepositories,
  TopUpsRepositoriesFactory,
} from '../../../../src/modules/top-ups/application/ports.ts';

/** Every port call, in order: the tests check what runs before what. */
export class CallLog {
  readonly calls: string[] = [];

  add(call: string): void {
    this.calls.push(call);
  }
}

interface StoredRecord extends IdempotencyClaim {
  response: StoredResponse | null;
}

/** Top-ups, idempotency records and audit events kept in memory. */
export class FakeTopUpsRepositories implements TopUpsRepositoriesFactory {
  readonly topUps: { state: TopUpState; phone: ProtectedPhone }[] = [];
  readonly records = new Map<string, StoredRecord>();
  readonly audit: AuditEvent[] = [];
  /** What the customer topped up earlier today, as the database would sum it. */
  spentToday = Money.zero();
  sinceAsked: Date | null = null;
  readonly #log: CallLog;

  constructor(log: CallLog) {
    this.#log = log;
  }

  for(): TopUpsRepositories {
    const idempotency: IdempotencyRepository = {
      claim: (claim): Promise<ClaimResult> => {
        const id = `${claim.userId}:${claim.key}`;
        const found = this.records.get(id);
        if (found) {
          return Promise.resolve({
            claimed: false,
            operation: found.operation,
            requestHash: found.requestHash,
            response: found.response,
          });
        }
        this.records.set(id, { ...claim, response: null });
        return Promise.resolve({ claimed: true });
      },
      complete: (userId, key, response): Promise<void> => {
        const record = this.records.get(`${userId}:${key}`);
        if (record) record.response = response;
        return Promise.resolve();
      },
    };
    const audit: AuditTrail = {
      record: (event): Promise<void> => {
        this.audit.push(event);
        return Promise.resolve();
      },
    };
    return {
      idempotency,
      audit,
      topUps: {
        insert: (state, phone): Promise<void> => {
          this.#log.add('insert');
          this.topUps.push({ state, phone });
          return Promise.resolve();
        },
        spentSince: (_accountId, since): Promise<Money> => {
          this.#log.add('spentSince');
          this.sinceAsked = since;
          return Promise.resolve(this.spentToday);
        },
        findForOwner: (id, accountId): Promise<TopUpState | null> =>
          Promise.resolve(
            this.topUps.find(({ state }) => state.id === id && state.accountId === accountId)
              ?.state ?? null,
          ),
      },
    };
  }
}

export class FakeAccounts implements AccountsPort {
  readonly #accounts: TopUpAccount[];

  constructor(accounts: TopUpAccount[]) {
    this.#accounts = accounts;
  }

  findByHolder(_tx: Transaction, userId: string): Promise<TopUpAccount | null> {
    return Promise.resolve(this.#accounts.find((a) => a.holderUserId === userId) ?? null);
  }

  lockForShare(_tx: Transaction, accountId: string): Promise<TopUpAccount> {
    const account = this.#accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`No account ${accountId}`);
    return Promise.resolve(account);
  }
}

export class FakeIdentity implements IdentityPort {
  next: PinCheck = { outcome: 'VERIFIED' };
  checks = 0;

  verifyPin(): Promise<PinCheck> {
    this.checks += 1;
    return Promise.resolve(this.next);
  }
}

class LedgerInsufficientFunds extends DomainError {
  readonly code = 'InsufficientFunds';
}

export class FakeLedger implements LedgerPort {
  readonly postings: TopUpPosting[] = [];
  balance = Money.of(100_000n);
  readonly #log: CallLog;

  constructor(log: CallLog) {
    this.#log = log;
  }

  lockCustomerAccount(): Promise<void> {
    this.#log.add('lockCustomerAccount');
    return Promise.resolve();
  }

  postTopUp(_tx: Transaction, posting: TopUpPosting): Promise<void> {
    this.#log.add('postTopUp');
    if (this.balance.isLessThan(posting.amount)) {
      throw new LedgerInsufficientFunds('balance below the amount');
    }
    this.balance = this.balance.minus(posting.amount);
    this.postings.push(posting);
    return Promise.resolve();
  }
}

export class FakeProvider implements TopUpProvider {
  readonly requests: TopUpRequest[] = [];
  fails = false;
  readonly #log: CallLog;

  constructor(log: CallLog) {
    this.#log = log;
  }

  recharge(request: TopUpRequest): Promise<{ reference: string }> {
    this.#log.add('recharge');
    if (this.fails) return Promise.reject(new Error('operator unavailable'));
    this.requests.push(request);
    return Promise.resolve({ reference: `ref-${String(this.requests.length)}` });
  }
}

/** Seals to a fixed text: enough to show the number is never stored in clear. */
export class FakePhoneProtector implements PhoneProtector {
  protect(): ProtectedPhone {
    return { ciphertext: new TextEncoder().encode('sealed'), keyVersion: 1 };
  }
}

export const ANA: TopUpAccount = {
  id: 'account-ana',
  holderUserId: 'user-ana',
  status: 'ACTIVE',
};

export const BRUNO: TopUpAccount = {
  id: 'account-bruno',
  holderUserId: 'user-bruno',
  status: 'ACTIVE',
};
