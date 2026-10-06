import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { InvalidCredentials } from '../domain/errors.ts';
import { LoginAttempts } from '../domain/login-attempts.ts';
import { Session } from '../domain/session.ts';
import { normalizeEmail } from '../domain/user.ts';
import type {
  AccessTokenIssuer,
  IdentityRepositoriesFactory,
  LoginAccount,
  LoginAttemptsStore,
  RefreshTokenGenerator,
  SecretHasher,
} from './ports.ts';

export interface LoginInput {
  email: string;
  password: string;
  deviceLabel: string | null;
  requestId: string | null;
}

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export interface LoginDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenIssuer;
  attempts: LoginAttemptsStore;
}

// Verified when the e-mail has no account, so that case costs one Argon2id
// verification like any other (AUTH-02). Its value matters to no one: without
// an account, a login always fails.
const DUMMY_SECRET = 'no account behind this e-mail';

type FailureReason = 'INVALID_PASSWORD' | 'ACCOUNT_LOCKED';

/** Login (ADR 0004): owned by Identity alone, so it lives here (ADR 0010). */
export class Login {
  readonly #deps: LoginDependencies;
  readonly #dummyHash: Promise<string>;

  constructor(deps: LoginDependencies) {
    this.#deps = deps;
    this.#dummyHash = deps.hasher.hash(DUMMY_SECRET);
  }

  async execute(input: LoginInput): Promise<LoginResult> {
    const { clock, hasher, attempts: store } = this.#deps;
    const email = normalizeEmail(input.email);
    const now = clock.now();
    const stored = store.get(email);
    const attempts = stored ? LoginAttempts.restore(stored) : LoginAttempts.none();
    attempts.assertAllowed(now);
    // Counted as a failure before any await (F-11): check and reservation run
    // without interruption, so a burst cannot slip past the limit while earlier
    // attempts are still hashing. A correct password clears it below.
    attempts.recordFailure(now);
    store.set(email, attempts.state);

    const account = await this.#deps.unitOfWork.run((tx) =>
      this.#deps.repositories.for(tx).users.findByEmail(email),
    );
    // Exactly one verification on every path, before any decision (AUTH-02).
    const passwordMatches = await hasher.verify(
      account?.passwordHash ?? (await this.#dummyHash),
      input.password,
    );

    const failure = this.#failureReason(account, passwordMatches);
    if (account === null || failure !== null) {
      // Already counted before the verification.
      if (account !== null && failure !== null) {
        // Persisted before the error is thrown (ADR 0010, rule 3).
        await this.#deps.unitOfWork.run((tx) =>
          this.#recordFailure(tx, account.id, failure, input.requestId, now),
        );
      }
      throw new InvalidCredentials();
    }

    store.delete(email);
    return this.#openSession(account.id, input, now);
  }

  #failureReason(account: LoginAccount | null, passwordMatches: boolean): FailureReason | null {
    if (account === null || !passwordMatches) return 'INVALID_PASSWORD';
    if (account.status !== 'ACTIVE') return 'ACCOUNT_LOCKED';
    return null;
  }

  async #recordFailure(
    tx: Transaction,
    userId: string,
    reason: FailureReason,
    requestId: string | null,
    now: Date,
  ): Promise<void> {
    // No authenticated actor: the system records an attempt against this account.
    await this.#deps.repositories.for(tx).audit.record({
      id: this.#deps.ids.next(),
      occurredAt: now,
      actorType: 'SYSTEM',
      actorId: null,
      action: 'LOGIN_FAILED',
      subjectType: 'USER',
      subjectId: userId,
      requestId,
      metadata: { reason },
    });
  }

  async #openSession(userId: string, input: LoginInput, now: Date): Promise<LoginResult> {
    const { ids } = this.#deps;
    const session = Session.create({ id: ids.next(), userId, deviceLabel: input.deviceLabel, now });
    const refreshToken = this.#deps.refreshTokens.generate();

    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      await repositories.sessions.insert(session.state);
      await repositories.refreshTokens.insert({
        id: ids.next(),
        sessionId: session.state.id,
        tokenHash: refreshToken.hash,
        createdAt: now,
      });
      const audited = {
        occurredAt: now,
        actorType: 'USER',
        actorId: userId,
        requestId: input.requestId,
        metadata: {},
      } as const;
      await repositories.audit.record({
        ...audited,
        id: ids.next(),
        action: 'LOGIN_SUCCEEDED',
        subjectType: 'USER',
        subjectId: userId,
      });
      await repositories.audit.record({
        ...audited,
        id: ids.next(),
        action: 'SESSION_CREATED',
        subjectType: 'SESSION',
        subjectId: session.state.id,
      });
    });

    const access = await this.#deps.accessTokens.issue({
      userId,
      sessionId: session.state.id,
      now,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refreshToken.token,
    };
  }
}
