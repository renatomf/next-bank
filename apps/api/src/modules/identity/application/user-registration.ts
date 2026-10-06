import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { Cpf } from '../domain/cpf.ts';
import { AlreadyRegistered } from '../domain/errors.ts';
import { type CommonPasswordList, Password } from '../domain/password.ts';
import { Session } from '../domain/session.ts';
import { User } from '../domain/user.ts';
import type {
  AccessTokenIssuer,
  CpfProtector,
  IdentityRepositoriesFactory,
  RefreshTokenGenerator,
  SecretHasher,
  StoredCpf,
} from './ports.ts';

export interface RegistrationInput {
  name: string;
  email: string;
  cpf: string;
  password: string;
  deviceLabel: string | null;
}

/** Validated and protected data, ready to be written. Holds no secret in clear. */
export interface PreparedRegistration {
  name: string;
  email: string;
  cpf: Cpf;
  storedCpf: StoredCpf;
  passwordHash: string;
  deviceLabel: string | null;
}

export interface RegisteredUser {
  userId: string;
  sessionId: string;
  refreshToken: string;
  registeredAt: Date;
}

export interface UserRegistrationDependencies {
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  cpfProtector: CpfProtector;
  commonPasswords: CommonPasswordList;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenIssuer;
}

/**
 * Identity's part of registration (domain-model.md, section 8), in the three
 * steps an orchestrator sequences (ADR 0010): prepare outside the transaction,
 * register inside it, issue the access token after the commit.
 */
export class UserRegistration {
  readonly #deps: UserRegistrationDependencies;

  constructor(deps: UserRegistrationDependencies) {
    this.#deps = deps;
  }

  /**
   * Validates CPF and password and does the slow work (Argon2id) without holding
   * a database connection. Runs for every attempt, so "already registered"
   * cannot answer faster and reveal who has an account (AUTH-02).
   */
  async prepare(input: RegistrationInput): Promise<PreparedRegistration> {
    const { hasher, cpfProtector, commonPasswords } = this.#deps;
    const cpf = Cpf.parse(input.cpf);
    const password = Password.create(input.password, commonPasswords);
    const passwordHash = await hasher.hash(password.value);
    const encrypted = cpfProtector.encrypt(cpf);
    return {
      name: input.name,
      email: input.email,
      cpf,
      storedCpf: {
        ciphertext: encrypted.ciphertext,
        blindIndex: cpfProtector.blindIndex(cpf),
        masked: cpf.masked,
        keyVersion: encrypted.keyVersion,
      },
      passwordHash,
      deviceLabel: input.deviceLabel,
    };
  }

  /** Writes user, session, refresh token hash and audit trail in the caller's transaction. */
  async register(
    tx: Transaction,
    prepared: PreparedRegistration,
    context: { requestId: string | null },
  ): Promise<RegisteredUser> {
    const { clock, ids } = this.#deps;
    const repositories = this.#deps.repositories.for(tx);
    const now = clock.now();
    const user = User.register({
      id: ids.next(),
      name: prepared.name,
      email: prepared.email,
      cpf: prepared.cpf,
      passwordHash: prepared.passwordHash,
      now,
    });
    if (
      await repositories.users.existsWithEmailOrCpf(user.state.email, prepared.storedCpf.blindIndex)
    ) {
      throw new AlreadyRegistered();
    }
    const session = Session.create({
      id: ids.next(),
      userId: user.state.id,
      deviceLabel: prepared.deviceLabel,
      now,
    });
    const refreshToken = this.#deps.refreshTokens.generate();

    await repositories.users.insert(user.state, prepared.storedCpf);
    await repositories.sessions.insert(session.state);
    await repositories.refreshTokens.insert({
      id: ids.next(),
      sessionId: session.state.id,
      tokenHash: refreshToken.hash,
      createdAt: now,
    });
    const audited = { occurredAt: now, actorType: 'USER', actorId: user.state.id } as const;
    await repositories.audit.record({
      ...audited,
      id: ids.next(),
      action: 'USER_REGISTERED',
      subjectType: 'USER',
      subjectId: user.state.id,
      requestId: context.requestId,
      metadata: {},
    });
    await repositories.audit.record({
      ...audited,
      id: ids.next(),
      action: 'SESSION_CREATED',
      subjectType: 'SESSION',
      subjectId: session.state.id,
      requestId: context.requestId,
      metadata: {},
    });
    return {
      userId: user.state.id,
      sessionId: session.state.id,
      refreshToken: refreshToken.token,
      registeredAt: now,
    };
  }

  /** Issued only after the commit, so a token never exists for a rolled-back user. */
  issueAccessToken(registered: RegisteredUser): Promise<{ token: string; expiresAt: Date }> {
    return this.#deps.accessTokens.issue({
      userId: registered.userId,
      sessionId: registered.sessionId,
      now: registered.registeredAt,
    });
  }
}
