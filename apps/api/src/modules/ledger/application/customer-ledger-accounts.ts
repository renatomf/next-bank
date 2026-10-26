import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { customerCodeOf, LedgerAccount } from '../domain/ledger-account.ts';
import type { PostJournalEntry } from './post-journal-entry.ts';
import type {
  LedgerRepositoryFactory,
  StatementFilter,
  StatementPosition,
  StatementRow,
} from './ports.ts';
import { NO_STATEMENT_FILTER } from './ports.ts';

/** Who is on one side of a Pix, as the other side's statement shows it. */
export interface PixParty {
  name: string;
  documentMasked: string;
}

export interface PixTransferPosting {
  transferId: string;
  payerAccountId: string;
  payeeAccountId: string;
  amount: Money;
  payer: PixParty;
  payee: PixParty;
}

/** A top-up leaving for an operator (v1.1.0 plan, task 5). */
export interface TopUpPosting {
  topUpId: string;
  accountId: string;
  operatorId: string;
  amount: Money;
  /** The operator and the masked number, as the statement shows them. */
  counterparty: { name: string; documentMasked: string };
}

/** A Pix to another bank leaving for the clearing account (v1.2.0 plan, task 3). */
export interface ExternalPixPosting {
  transferId: string;
  payerAccountId: string;
  amount: Money;
  /** The payee at the other bank, as the statement shows it. */
  payee: PixParty;
}

export type StatementItemKind =
  'PIX_SENT' | 'PIX_RECEIVED' | 'PIX_REFUNDED' | 'DEMO_FUNDING' | 'TOP_UP';

export interface StatementItem {
  /** The posting's id. */
  id: string;
  occurredAt: Date;
  kind: StatementItemKind;
  direction: 'IN' | 'OUT';
  /** Always positive: the direction gives the sign. */
  amount: Money;
  counterparty: { name: string; documentMasked: string | null } | null;
  transferId: string | null;
  /** The top-up of a TOP_UP item: the link to its receipt. */
  topUpId: string | null;
}

export interface StatementPage {
  items: StatementItem[];
  /** Where the next page starts, or null on the last one. */
  next: StatementPosition | null;
}

/** At most 20 items: the client never chooses the size (READ-04). */
const STATEMENT_PAGE_SIZE = 20;

const FUNDING_CODE = 'system:funding';
/** Where an external Pix waits for the SPI's answer (domain-model.md, section 5). */
const PIX_CLEARING_CODE = 'system:pix_clearing';
/** Where the money of a settled external Pix ends (domain-model.md, section 6). */
const BACEN_SETTLEMENT_CODE = 'system:bacen_settlement';
/** Who the customer sees on the other side of the demo funding. */
const FUNDING_COUNTERPARTY = 'next bank';

/**
 * What the other contexts ask of the ledger about a customer's current
 * account (domain-model.md, sections 5, 6 and 8). The current account is
 * referenced only by its id: the ledger knows nothing else about it.
 */
export class CustomerLedgerAccounts {
  readonly #repositories: LedgerRepositoryFactory;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  readonly #postJournalEntry: PostJournalEntry;

  constructor(deps: {
    repositories: LedgerRepositoryFactory;
    clock: Clock;
    ids: IdGenerator;
    postJournalEntry: PostJournalEntry;
  }) {
    this.#repositories = deps.repositories;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
    this.#postJournalEntry = deps.postJournalEntry;
  }

  /** Every current account has its own ledger account. */
  async open(tx: Transaction, accountId: string): Promise<void> {
    const account = LedgerAccount.openCustomer({
      id: this.#ids.next(),
      accountId,
      now: this.#clock.now(),
    });
    await this.#repositories.for(tx).insertAccount(account.state);
  }

  /**
   * Credits the demo balance from system:funding (D3). The account is the
   * reference, so the database refuses a second funding (T-DB-05).
   */
  async fund(tx: Transaction, input: { accountId: string; amount: Money }): Promise<void> {
    const repository = this.#repositories.for(tx);
    const customer = await repository.findByCode(customerCodeOf(input.accountId));
    const funding = await repository.findByCode(FUNDING_CODE);
    if (!customer || !funding) {
      throw new Error(`Cannot fund account ${input.accountId}: ledger account missing`);
    }

    await this.#postJournalEntry.execute(tx, {
      kind: 'FUNDING',
      referenceType: 'ACCOUNT',
      referenceId: input.accountId,
      postings: [
        {
          ledgerAccountId: funding.id,
          direction: 'DEBIT',
          amount: input.amount,
          counterpartyName: null,
          counterpartyDocumentMasked: null,
        },
        {
          ledgerAccountId: customer.id,
          direction: 'CREDIT',
          amount: input.amount,
          counterpartyName: FUNDING_COUNTERPARTY,
          counterpartyDocumentMasked: null,
        },
      ],
    });
  }

  /**
   * An internal Pix (domain-model.md 6): debit the payer, credit the payee, each
   * side keeping who was on the other for the statement (section 8.1). The
   * transfer is the reference, so a Pix is posted at most once (T-DB-05). A
   * debit above the balance fails with InsufficientFunds before any write.
   */
  async transferPix(tx: Transaction, input: PixTransferPosting): Promise<void> {
    const repository = this.#repositories.for(tx);
    const payer = await repository.findByCode(customerCodeOf(input.payerAccountId));
    const payee = await repository.findByCode(customerCodeOf(input.payeeAccountId));
    if (!payer || !payee) {
      throw new Error(`Cannot post Pix ${input.transferId}: ledger account missing`);
    }

    await this.#postJournalEntry.execute(tx, {
      kind: 'PIX_INTERNAL',
      referenceType: 'PIX_TRANSFER',
      referenceId: input.transferId,
      postings: [
        {
          ledgerAccountId: payer.id,
          direction: 'DEBIT',
          amount: input.amount,
          counterpartyName: input.payee.name,
          counterpartyDocumentMasked: input.payee.documentMasked,
        },
        {
          ledgerAccountId: payee.id,
          direction: 'CREDIT',
          amount: input.amount,
          counterpartyName: input.payer.name,
          counterpartyDocumentMasked: input.payer.documentMasked,
        },
      ],
    });
  }

  /**
   * A Pix to another bank (v1.2.0 plan, task 3): debit the payer, credit
   * system:pix_clearing, where the money waits for the SPI; the answer
   * settles or refunds it (task 4). Only the payer's posting keeps the payee,
   * for the statement. The transfer is the reference, so it is posted at most
   * once (T-DB-05); a debit above the balance fails with InsufficientFunds
   * before any write.
   */
  async sendPixExternal(tx: Transaction, input: ExternalPixPosting): Promise<void> {
    const repository = this.#repositories.for(tx);
    const payer = await repository.findByCode(customerCodeOf(input.payerAccountId));
    const clearing = await repository.findByCode(PIX_CLEARING_CODE);
    if (!payer || !clearing) {
      throw new Error(`Cannot post external Pix ${input.transferId}: ledger account missing`);
    }

    await this.#postJournalEntry.execute(tx, {
      kind: 'PIX_EXTERNAL',
      referenceType: 'PIX_TRANSFER',
      referenceId: input.transferId,
      postings: [
        {
          ledgerAccountId: payer.id,
          direction: 'DEBIT',
          amount: input.amount,
          counterpartyName: input.payee.name,
          counterpartyDocumentMasked: input.payee.documentMasked,
        },
        {
          ledgerAccountId: clearing.id,
          direction: 'CREDIT',
          amount: input.amount,
          counterpartyName: null,
          counterpartyDocumentMasked: null,
        },
      ],
    });
  }

  /**
   * The SPI settled an external Pix (v1.2.0 plan, task 4): the money moves
   * from system:pix_clearing to system:bacen_settlement. Only system
   * accounts, which are never locked nor projected; the customer's balance
   * moved at the authorization. Posted at most once per Pix (T-DB-05).
   */
  async settlePixExternal(
    tx: Transaction,
    input: { transferId: string; amount: Money },
  ): Promise<void> {
    const repository = this.#repositories.for(tx);
    const clearing = await repository.findByCode(PIX_CLEARING_CODE);
    const settlement = await repository.findByCode(BACEN_SETTLEMENT_CODE);
    if (!clearing || !settlement) {
      throw new Error(`Cannot settle external Pix ${input.transferId}: ledger account missing`);
    }
    await this.#postJournalEntry.execute(tx, {
      kind: 'PIX_EXTERNAL_SETTLEMENT',
      referenceType: 'PIX_TRANSFER',
      referenceId: input.transferId,
      postings: [
        { ...systemSide(clearing.id, 'DEBIT'), amount: input.amount },
        { ...systemSide(settlement.id, 'CREDIT'), amount: input.amount },
      ],
    });
  }

  /**
   * The SPI refused an external Pix (v1.2.0 plan, task 4; D6): the money
   * comes back from system:pix_clearing to the payer, whose posting keeps
   * the payee it never reached, for the statement. Posted at most once per
   * Pix (T-DB-05).
   */
  async refundPixExternal(tx: Transaction, input: ExternalPixPosting): Promise<void> {
    const repository = this.#repositories.for(tx);
    const clearing = await repository.findByCode(PIX_CLEARING_CODE);
    const payer = await repository.findByCode(customerCodeOf(input.payerAccountId));
    if (!clearing || !payer) {
      throw new Error(`Cannot refund external Pix ${input.transferId}: ledger account missing`);
    }
    await this.#postJournalEntry.execute(tx, {
      kind: 'PIX_EXTERNAL_REFUND',
      referenceType: 'PIX_TRANSFER',
      referenceId: input.transferId,
      postings: [
        { ...systemSide(clearing.id, 'DEBIT'), amount: input.amount },
        {
          ledgerAccountId: payer.id,
          direction: 'CREDIT',
          amount: input.amount,
          counterpartyName: input.payee.name,
          counterpartyDocumentMasked: input.payee.documentMasked,
        },
      ],
    });
  }

  /**
   * Locks the customer's ledger account (FOR UPDATE) without posting: a
   * top-up takes it before reading the day's total, so two top-ups of one
   * customer run one at a time (v1.1.0 plan, task 5).
   */
  async lockCustomer(tx: Transaction, accountId: string): Promise<void> {
    const repository = this.#repositories.for(tx);
    const customer = await repository.findByCode(customerCodeOf(accountId));
    if (!customer) throw new Error(`No ledger account for account ${accountId}`);
    await repository.lockForPosting([customer.id]);
  }

  /**
   * A top-up (v1.1.0 plan, task 5): debit the customer, credit the operator's
   * system account. Only the customer's posting keeps who was on the other
   * side, for the statement. The top-up is the reference, so it is posted at
   * most once (T-DB-05). A debit above the balance fails with
   * InsufficientFunds before any write.
   */
  async topUp(tx: Transaction, input: TopUpPosting): Promise<void> {
    const repository = this.#repositories.for(tx);
    const customer = await repository.findByCode(customerCodeOf(input.accountId));
    const operator = await repository.findByCode(topUpCodeOf(input.operatorId));
    if (!customer || !operator) {
      throw new Error(
        `Cannot post top-up ${input.topUpId} to ${input.operatorId}: ledger account missing`,
      );
    }

    await this.#postJournalEntry.execute(tx, {
      kind: 'TOP_UP',
      referenceType: 'TOP_UP',
      referenceId: input.topUpId,
      postings: [
        {
          ledgerAccountId: customer.id,
          direction: 'DEBIT',
          amount: input.amount,
          counterpartyName: input.counterparty.name,
          counterpartyDocumentMasked: input.counterparty.documentMasked,
        },
        {
          ledgerAccountId: operator.id,
          direction: 'CREDIT',
          amount: input.amount,
          counterpartyName: null,
          counterpartyDocumentMasked: null,
        },
      ],
    });
  }

  /**
   * One page of the statement (domain-model.md 8.1): newest first, the ledger
   * only, each item with the counterparty kept in its posting. A sent Pix
   * carries its transfer, the link to the receipt; a received one does not,
   * since only the payer reaches a Pix (PIX-01; week 6 plan, D3).
   */
  async statement(
    tx: Transaction,
    accountId: string,
    after: StatementPosition | null,
    filter: StatementFilter = NO_STATEMENT_FILTER,
  ): Promise<StatementPage> {
    const repository = this.#repositories.for(tx);
    const account = await repository.findByCode(customerCodeOf(accountId));
    if (!account) throw new Error(`No ledger account for account ${accountId}`);

    // One more than a page tells whether another page follows.
    const rows = await repository.statementPage(account.id, after, STATEMENT_PAGE_SIZE + 1, filter);
    const page = rows.slice(0, STATEMENT_PAGE_SIZE);
    const last = page.at(-1);
    return {
      items: page.map(statementItemOf),
      next:
        rows.length > STATEMENT_PAGE_SIZE && last
          ? { createdAt: last.position, postingId: last.postingId }
          : null,
    };
  }

  /** A plain read, without a lock: it never waits for a posting in progress. */
  async availableBalance(tx: Transaction, accountId: string): Promise<Money | null> {
    const account = await this.#repositories.for(tx).findByCode(customerCodeOf(accountId));
    return account?.availableBalance ?? null;
  }
}

/** A system account's side of an entry: no one to show on the other side. */
function systemSide(ledgerAccountId: string, direction: 'DEBIT' | 'CREDIT') {
  return { ledgerAccountId, direction, counterpartyName: null, counterpartyDocumentMasked: null };
}

/** The system account of a top-up operator: system:top-up-<id>. */
function topUpCodeOf(operatorId: string): string {
  return `system:top-up-${operatorId}`;
}

function kindOf(row: StatementRow): StatementItemKind {
  switch (row.entryKind) {
    case 'FUNDING':
      return 'DEMO_FUNDING';
    case 'TOP_UP':
      return 'TOP_UP';
    case 'PIX_INTERNAL':
      return row.direction === 'DEBIT' ? 'PIX_SENT' : 'PIX_RECEIVED';
    // The customer only ever sends one, and gets it back when the SPI refuses it.
    case 'PIX_EXTERNAL':
      return 'PIX_SENT';
    case 'PIX_EXTERNAL_REFUND':
      return 'PIX_REFUNDED';
    // Only system accounts: it never reaches a customer's statement.
    case 'PIX_EXTERNAL_SETTLEMENT':
      throw new Error('A settlement has no customer posting');
  }
}

function statementItemOf(row: StatementRow): StatementItem {
  const sent = row.direction === 'DEBIT';
  const kind = kindOf(row);
  return {
    id: row.postingId,
    occurredAt: row.occurredAt,
    kind,
    direction: sent ? 'OUT' : 'IN',
    amount: row.amount,
    counterparty:
      row.counterpartyName === null
        ? null
        : { name: row.counterpartyName, documentMasked: row.counterpartyDocumentMasked },
    transferId: kind === 'PIX_SENT' || kind === 'PIX_REFUNDED' ? row.referenceId : null,
    topUpId: kind === 'TOP_UP' ? row.referenceId : null,
  };
}
