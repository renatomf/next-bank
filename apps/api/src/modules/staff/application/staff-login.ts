import type {
  Clock,
  IdGenerator,
  LoginAttemptsStore,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { LoginAttempts } from '../../../shared/domain/login-attempts.ts';
import { InvalidCredentials } from '../domain/errors.ts';
import type { StaffRole } from '../domain/permissions.ts';
import { StaffMember } from '../domain/staff-member.ts';
import { StaffSession } from '../domain/staff-session.ts';
import type {
  SecretBox,
  SecretHasher,
  SessionTokens,
  StaffMemberRecord,
  StaffRepositoriesFactory,
  TotpVerifier,
} from './ports.ts';

export interface StaffLoginInput {
  email: string;
  password: string;
  mfaCode: string;
  requestId: string | null;
}

export interface StaffLoginResult {
  token: string;
  expiresAt: Date;
  member: { name: string; role: StaffRole };
}

export interface StaffLoginDependencies {
  unitOfWork: UnitOfWork;
  repositories: StaffRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  totp: TotpVerifier;
  secrets: SecretBox;
  tokens: SessionTokens;
  attempts: LoginAttemptsStore;
}

type FailureReason = 'INVALID_PASSWORD' | 'INVALID_CODE' | 'CODE_REUSED' | 'MEMBER_DISABLED';

// Verified when the e-mail has no member, so that case costs one Argon2id
// verification like any other (AUTH-02).
const DUMMY_SECRET = 'no staff member behind this e-mail';

/**
 * The staff's login (v1.3.0 plan, task 1; STF-01, S2): password and TOTP
 * code in one step. Every wrong factor gets the same refusal; why it failed
 * is only in the audit. The e-mail blocks as a customer's does (AUTH-01).
 */
export class StaffLogin {
  readonly #deps: StaffLoginDependencies;
  readonly #dummyHash: Promise<string>;

  constructor(deps: StaffLoginDependencies) {
    this.#deps = deps;
    this.#dummyHash = deps.hasher.hash(DUMMY_SECRET);
  }

  async execute(input: StaffLoginInput): Promise<StaffLoginResult> {
    const { clock, attempts: store } = this.#deps;
    const email = input.email.trim().toLowerCase();
    const now = clock.now();
    const stored = store.get(email);
    const attempts = stored ? LoginAttempts.restore(stored) : LoginAttempts.none();
    attempts.assertAllowed(now);
    // Counted before any await (F-11); a successful login clears it below.
    attempts.recordFailure(now);
    store.set(email, attempts.state);

    const record = await this.#deps.unitOfWork.run((tx) =>
      this.#deps.repositories.for(tx).members.findByEmail(email),
    );
    const passwordMatches = await this.#deps.hasher.verify(
      record?.passwordHash ?? (await this.#dummyHash),
      input.password,
    );
    if (record === null) throw new InvalidCredentials();
    const step = passwordMatches ? this.#stepOf(record, input.mfaCode, now) : null;

    const outcome = await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      // Locked, so the same code twice at the same time opens one session.
      const locked = await repositories.members.lock(record.state.id);
      const member = StaffMember.restore(locked ?? record.state);
      const failure = this.#failureReason(member, passwordMatches, step, now);
      if (failure !== null) {
        // Recorded before the refusal is thrown (ADR 0010, rule 3).
        await repositories.audit.record({
          id: this.#deps.ids.next(),
          occurredAt: now,
          actorType: 'SYSTEM',
          actorId: null,
          action: 'STAFF_LOGIN_FAILED',
          subjectType: 'STAFF_MEMBER',
          subjectId: member.state.id,
          requestId: input.requestId,
          metadata: { reason: failure },
        });
        return null;
      }
      await repositories.members.update(member.state);
      const session = StaffSession.open({
        id: this.#deps.ids.next(),
        memberId: member.state.id,
        now,
      });
      const token = this.#deps.tokens.generate();
      await repositories.sessions.insert(session.state, token.hash);
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'STAFF',
        actorId: member.state.id,
        action: 'STAFF_LOGIN_SUCCEEDED',
        subjectType: 'STAFF_SESSION',
        subjectId: session.state.id,
        requestId: input.requestId,
        metadata: {},
      });
      return {
        token: token.token,
        expiresAt: session.state.expiresAt,
        member: { name: member.state.name, role: member.state.role },
      };
    });

    if (outcome === null) throw new InvalidCredentials();
    store.delete(email);
    return outcome;
  }

  #stepOf(record: StaffMemberRecord, code: string, now: Date): number | null {
    return this.#deps.totp.stepOf(this.#deps.secrets.open(record.totpSecret), code, now);
  }

  /** Why the login fails, checked on the member as locked; null when it passes. */
  #failureReason(
    member: StaffMember,
    passwordMatches: boolean,
    step: number | null,
    now: Date,
  ): FailureReason | null {
    if (!passwordMatches) return 'INVALID_PASSWORD';
    if (step === null) return 'INVALID_CODE';
    if (!member.isActive) return 'MEMBER_DISABLED';
    // Takes the step on the member, which the login saves when it passes.
    if (!member.acceptTotpStep(step, now)) return 'CODE_REUSED';
    return null;
  }
}
