import type { UnitOfWork } from '../../shared/application/ports.ts';
import type { IdentityRegistration, RegistrationInput } from '../../modules/identity/index.ts';

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

/**
 * Registration across contexts (domain-model.md, section 8; ADR 0010). It only
 * sequences module calls: business rules live in the modules. Accounts, the
 * initial funding and the CPF Pix key join the same transaction in weeks 4 and 5.
 */
export class RegisterCustomer {
  readonly #unitOfWork: UnitOfWork;
  readonly #identity: IdentityRegistration;

  constructor(deps: { unitOfWork: UnitOfWork; identity: IdentityRegistration }) {
    this.#unitOfWork = deps.unitOfWork;
    this.#identity = deps.identity;
  }

  async execute(input: RegisterCustomerInput): Promise<RegisterCustomerResult> {
    const prepared = await this.#identity.prepare(input);
    const registered = await this.#unitOfWork.run((tx) =>
      this.#identity.register(tx, prepared, { requestId: input.requestId }),
    );
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
