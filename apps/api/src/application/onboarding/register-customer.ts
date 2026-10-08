import type { Transaction, UnitOfWork } from '../../shared/application/ports.ts';
import type { Cpf } from '../../shared/domain/cpf.ts';
import { Money } from '../../shared/domain/money.ts';
import type { RegisterUserSteps, RegistrationInput } from '../../modules/identity/index.ts';

/** Demo balance every new customer receives (domain-model.md, decision D3). */
const DEMO_FUNDING = Money.of(1_000_000n);

export interface RegisterCustomerInput extends RegistrationInput {
  requestId: string | null;
}

export interface RegisterCustomerResult {
  userId: string;
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

/** Accounts' step: opens the current account and returns its id. */
export interface OpenAccountStep {
  execute(
    tx: Transaction,
    input: { holderUserId: string; requestId: string | null },
  ): Promise<string>;
}

/** Ledger's step: credits the demo balance to the account. */
export interface FundAccountStep {
  fund(tx: Transaction, input: { accountId: string; amount: Money }): Promise<void>;
}

/** Payments' step: registers the holder's CPF as the Pix key of the account. */
export interface CpfKeyStep {
  execute(tx: Transaction, input: { accountId: string; cpf: Cpf }): Promise<void>;
}

/**
 * Registration across contexts (domain-model.md, section 8; ADR 0010). It only
 * sequences module calls: business rules live in the modules. User, account,
 * ledger account, funding and CPF Pix key commit together or not at all.
 */
export class RegisterCustomer {
  readonly #unitOfWork: UnitOfWork;
  readonly #identity: RegisterUserSteps;
  readonly #accounts: OpenAccountStep;
  readonly #ledger: FundAccountStep;
  readonly #payments: CpfKeyStep;

  constructor(deps: {
    unitOfWork: UnitOfWork;
    identity: RegisterUserSteps;
    accounts: OpenAccountStep;
    ledger: FundAccountStep;
    payments: CpfKeyStep;
  }) {
    this.#unitOfWork = deps.unitOfWork;
    this.#identity = deps.identity;
    this.#accounts = deps.accounts;
    this.#ledger = deps.ledger;
    this.#payments = deps.payments;
  }

  async execute(input: RegisterCustomerInput): Promise<RegisterCustomerResult> {
    const prepared = await this.#identity.prepare(input);
    const registered = await this.#unitOfWork.run(async (tx) => {
      const user = await this.#identity.register(tx, prepared, { requestId: input.requestId });
      const accountId = await this.#accounts.execute(tx, {
        holderUserId: user.userId,
        requestId: input.requestId,
      });
      await this.#ledger.fund(tx, { accountId, amount: DEMO_FUNDING });
      await this.#payments.execute(tx, { accountId, cpf: prepared.cpf });
      return user;
    });
    const access = await this.#identity.issueAccessToken(registered);
    return {
      userId: registered.userId,
      sessionId: registered.sessionId,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: registered.refreshToken,
    };
  }
}
