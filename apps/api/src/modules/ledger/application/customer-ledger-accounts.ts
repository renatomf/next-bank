import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { customerCodeOf, LedgerAccount } from '../domain/ledger-account.ts';
import type { PostJournalEntry } from './post-journal-entry.ts';
import type { LedgerRepositoryFactory } from './ports.ts';

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

const FUNDING_CODE = 'system:funding';
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

  /** A plain read, without a lock: it never waits for a posting in progress. */
  async availableBalance(tx: Transaction, accountId: string): Promise<Money | null> {
    const account = await this.#repositories.for(tx).findByCode(customerCodeOf(accountId));
    return account?.availableBalance ?? null;
  }
}
