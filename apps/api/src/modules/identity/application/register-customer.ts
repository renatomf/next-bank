import type { Clock, IdGenerator } from '../../../shared/application/ports.ts';
import { Cpf } from '../domain/cpf.ts';
import { AlreadyRegistered } from '../domain/errors.ts';
import { type CommonPasswordList, Password } from '../domain/password.ts';
import { Session } from '../domain/session.ts';
import { User } from '../domain/user.ts';
import type {
  AccessTokenIssuer,
  CpfProtector,
  IdentityUnitOfWork,
  RefreshTokenGenerator,
  SecretHasher,
} from './ports.ts';

export interface RegisterCustomerInput {
  name: string;
  email: string;
  cpf: string;
  password: string;
  deviceLabel: string | null;
  requestId: string | null;
}

export interface RegisterCustomerResult {
  userId: string;
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export interface RegisterCustomerDependencies {
  unitOfWork: IdentityUnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  cpfProtector: CpfProtector;
  commonPasswords: CommonPasswordList;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenIssuer;
}

/**
 * Registers a customer and logs them in (domain-model.md, section 8). Accounts,
 * funding and the CPF Pix key join this same transaction in weeks 4 and 5.
 */
export class RegisterCustomer {
  readonly #deps: RegisterCustomerDependencies;

  constructor(deps: RegisterCustomerDependencies) {
    this.#deps = deps;
  }

  async execute(input: RegisterCustomerInput): Promise<RegisterCustomerResult> {
    const { clock, ids, hasher, cpfProtector, commonPasswords } = this.#deps;
    const cpf = Cpf.parse(input.cpf);
    const password = Password.create(input.password, commonPasswords);
    // Hashed before checking for an existing account: otherwise "already
    // registered" would answer much faster and reveal who has an account.
    const passwordHash = await hasher.hash(password.value);
    const now = clock.now();

    const user = User.register({
      id: ids.next(),
      name: input.name,
      email: input.email,
      cpf,
      passwordHash,
      now,
    });
    const session = Session.create({
      id: ids.next(),
      userId: user.state.id,
      deviceLabel: input.deviceLabel,
      now,
    });
    const refreshToken = this.#deps.refreshTokens.generate();
    const encrypted = cpfProtector.encrypt(cpf);
    const cpfBlindIndex = cpfProtector.blindIndex(cpf);

    await this.#deps.unitOfWork.run(async (tx) => {
      if (await tx.users.existsWithEmailOrCpf(user.state.email, cpfBlindIndex)) {
        throw new AlreadyRegistered();
      }
      await tx.users.insert(user.state, {
        ciphertext: encrypted.ciphertext,
        blindIndex: cpfBlindIndex,
        masked: cpf.masked,
        keyVersion: encrypted.keyVersion,
      });
      await tx.sessions.insert(session.state);
      await tx.refreshTokens.insert({
        id: ids.next(),
        sessionId: session.state.id,
        tokenHash: refreshToken.hash,
        createdAt: now,
      });
      const audited = { occurredAt: now, actorType: 'USER', actorId: user.state.id } as const;
      const requestId = input.requestId;
      await tx.audit.record({
        ...audited,
        id: ids.next(),
        action: 'USER_REGISTERED',
        subjectType: 'USER',
        subjectId: user.state.id,
        requestId,
        metadata: {},
      });
      await tx.audit.record({
        ...audited,
        id: ids.next(),
        action: 'SESSION_CREATED',
        subjectType: 'SESSION',
        subjectId: session.state.id,
        requestId,
        metadata: {},
      });
    });

    const access = await this.#deps.accessTokens.issue({
      userId: user.state.id,
      sessionId: session.state.id,
      now,
    });
    return {
      userId: user.state.id,
      sessionId: session.state.id,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refreshToken.token,
    };
  }
}
