import type { Money } from '../../../shared/domain/money.ts';
import { InvalidAmount, InvalidTransferState, SamePayerAndPayee } from './errors.ts';
import type { PixKeyType } from './pix-key.ts';
import { assertWithinLimit, transferLimitAt } from './transfer-limits.ts';

const AUTHORIZATION_WINDOW_MS = 10 * 60_000;
const MAX_DESCRIPTION_LENGTH = 140;

export type PixTransferStatus =
  'AWAITING_AUTH' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type PixFailureReason =
  | 'INSUFFICIENT_FUNDS'
  | 'LIMIT_EXCEEDED'
  | 'PAYEE_UNAVAILABLE'
  | 'ACCOUNT_BLOCKED'
  // The SPI refused a Pix to another bank, whatever its cause (v1.2.0 plan, W1).
  | 'PAYEE_BANK_REJECTED';

/** The other bank of a payee outside next bank, as the DICT names it. */
export interface PayeeBank {
  ispb: string;
  name: string;
}

/**
 * Who receives, as it was when the Pix was created: the receipt shows this.
 * Either a next bank account or a key at another bank, never both (P3).
 */
export interface PixPayee {
  /** Null when the payee is at another bank. */
  accountId: string | null;
  /** Only for a payee at another bank. */
  bank?: PayeeBank;
  name: string;
  /** Never the full CPF: the payer sees only the masked document. */
  documentMasked: string;
  keyType: PixKeyType;
  keyMasked: string;
}

export interface PixTransferState {
  id: string;
  endToEndId: string | null;
  payerAccountId: string;
  payee: PixPayee;
  amount: Money;
  description: string | null;
  status: PixTransferStatus;
  failureReason: PixFailureReason | null;
  version: number;
  createdAt: Date;
  expiresAt: Date;
  authorizedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface CreatePixTransferInput {
  id: string;
  payerAccountId: string;
  payee: PixPayee;
  amount: Money;
  description: string | null;
  now: Date;
}

/**
 * An internal Pix and its state machine (domain-model.md 3.4 and 4). It is
 * born awaiting the PIN, and moves only along the diagram: a Pix is processed
 * at most once (PIX-08). Business failures are states, not exceptions, so the
 * use case can record them (ADR 0010, rule 3).
 */
export class PixTransfer {
  #state: PixTransferState;

  private constructor(state: PixTransferState) {
    this.#state = { ...state, payee: { ...state.payee } };
  }

  /** Amount, accounts and limit are checked early here, and again at authorization. */
  static create(input: CreatePixTransferInput): PixTransfer {
    if ((input.payee.accountId === null) === (input.payee.bank === undefined)) {
      throw new Error('A Pix goes to a next bank account or to another bank, never both');
    }
    if (!input.amount.isPositive()) throw new InvalidAmount();
    if (input.payee.accountId === input.payerAccountId) throw new SamePayerAndPayee();
    if (input.description !== null && input.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`A Pix description has at most ${String(MAX_DESCRIPTION_LENGTH)} characters`);
    }
    assertWithinLimit(input.amount, input.now);

    return new PixTransfer({
      id: input.id,
      endToEndId: null,
      payerAccountId: input.payerAccountId,
      payee: input.payee,
      amount: input.amount,
      description: input.description === '' ? null : input.description,
      status: 'AWAITING_AUTH',
      failureReason: null,
      version: 0,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + AUTHORIZATION_WINDOW_MS),
      authorizedAt: null,
      completedAt: null,
      updatedAt: input.now,
    });
  }

  static restore(state: PixTransferState): PixTransfer {
    return new PixTransfer(state);
  }

  get state(): Readonly<PixTransferState> {
    return { ...this.#state, payee: { ...this.#state.payee } };
  }

  get goesToAnotherBank(): boolean {
    return this.#state.payee.accountId === null;
  }

  isExpired(now: Date): boolean {
    return now >= this.#state.expiresAt;
  }

  /** The limit may differ from creation: the hour is checked again (domain-model.md 4). */
  exceedsLimitAt(now: Date): boolean {
    return transferLimitAt(now).isLessThan(this.#state.amount);
  }

  /** A settled Pix is refused before the PIN is checked: it never costs an attempt (PIX-08). */
  assertAwaitingAuthorization(): void {
    this.#require('AWAITING_AUTH');
  }

  /** The PIN was right: the Pix is being processed. An expired Pix must be cancelled instead. */
  startProcessing(now: Date): void {
    this.#require('AWAITING_AUTH');
    if (this.isExpired(now)) throw new Error('An expired Pix cannot be authorized: cancel it');
    this.#move('PROCESSING', now);
    this.#state.authorizedAt = now;
  }

  /**
   * Debited and on its way to the SPI: the end-to-end id is drawn now and goes
   * with every attempt, so the SPI takes the Pix once (EXT-03). It stays
   * processing until the SPI answers (task 4).
   */
  awaitSettlement(endToEndId: string): void {
    if (!this.goesToAnotherBank) throw new Error('Only a Pix to another bank waits for the SPI');
    this.#require('PROCESSING');
    if (this.#state.endToEndId !== null) throw new InvalidTransferState();
    this.#state.endToEndId = endToEndId;
  }

  /** The SPI settled it (v1.2.0 plan, task 4): completed with the id it was sent with. */
  settle(now: Date): void {
    this.#requireSent();
    this.#move('COMPLETED', now);
    this.#state.completedAt = now;
  }

  /**
   * The SPI refused it (v1.2.0 plan, task 4, W1): failed, keeping the id it
   * was sent with, so the refusal can be traced to the SPI's record.
   */
  rejectBySpi(now: Date): void {
    this.#requireSent();
    this.#move('FAILED', now);
    this.#state.failureReason = 'PAYEE_BANK_REJECTED';
  }

  /** Waiting for the SPI: sent to another bank, processing, with its id. */
  #requireSent(): void {
    if (!this.goesToAnotherBank) throw new Error('Only a Pix to another bank has an SPI answer');
    this.#require('PROCESSING');
    if (this.#state.endToEndId === null) {
      throw new Error('A Pix the SPI never got has no end-to-end id to answer');
    }
  }

  complete(endToEndId: string, now: Date): void {
    this.#require('PROCESSING');
    this.#move('COMPLETED', now);
    this.#state.endToEndId = endToEndId;
    this.#state.completedAt = now;
  }

  fail(reason: PixFailureReason, now: Date): void {
    this.#require('PROCESSING');
    this.#move('FAILED', now);
    this.#state.failureReason = reason;
  }

  /** By the customer, after a PIN lock or on expiry (domain-model.md 4). */
  cancel(now: Date): void {
    this.#require('AWAITING_AUTH');
    this.#move('CANCELLED', now);
  }

  #require(status: PixTransferStatus): void {
    if (this.#state.status !== status) throw new InvalidTransferState();
  }

  #move(status: PixTransferStatus, now: Date): void {
    this.#state.status = status;
    this.#state.updatedAt = now;
    this.#state.version += 1;
  }
}
