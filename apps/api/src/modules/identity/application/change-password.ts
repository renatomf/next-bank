import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { Unauthenticated } from '../domain/errors.ts';
import { type CommonPasswordList, Password } from '../domain/password.ts';
import { Session } from '../domain/session.ts';
import { confirmPassword } from './confirm-password.ts';
import type { IdentityRepositoriesFactory, LoginAttemptsStore, SecretHasher } from './ports.ts';

export interface ChangePasswordInput {
  /** From the verified access token, never from the request body. */
  userId: string;
  /** The session that asks: the only one that goes on. */
  sessionId: string;
  currentPassword: string;
  newPassword: string;
  requestId: string | null;
}

export interface ChangePasswordDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  /** The login's counter: wrong passwords here count with the login's (AUTH-01). */
  attempts: LoginAttemptsStore;
  commonPasswords: CommonPasswordList;
}

/**
 * A new password with the current one (domain-model.md 3.1, ASVS). Every other
 * session ends in the same transaction (AUTH-06): whoever knew the old password
 * and signed in elsewhere is out.
 */
export class ChangePassword {
  readonly #deps: ChangePasswordDependencies;

  constructor(deps: ChangePasswordDependencies) {
    this.#deps = deps;
  }

  async execute(input: ChangePasswordInput): Promise<void> {
    // The policy of the registration (AUTH-07, AUTH-08), before any attempt counts.
    const newPassword = Password.create(input.newPassword, this.#deps.commonPasswords);
    const now = this.#deps.clock.now();
    const credentials = await this.#deps.unitOfWork.run((tx) =>
      this.#deps.repositories.for(tx).users.findCredentials(input.userId),
    );
    // The token names a user that no longer exists: nothing to change.
    if (credentials === null) throw new Unauthenticated();
    await confirmPassword(this.#deps, credentials, input.currentPassword, now);

    const passwordHash = await this.#deps.hasher.hash(newPassword.value);
    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      await repositories.users.updatePasswordHash(input.userId, passwordHash);
      // Locked in id order: a refresh racing with this waits, then finds its
      // session ended.
      const others = (await repositories.sessions.lockActiveByUser(input.userId, now)).filter(
        (state) => state.id !== input.sessionId,
      );
      for (const state of others) {
        const session = Session.restore(state);
        session.revoke('PASSWORD_CHANGED', now);
        await repositories.sessions.update(session.state);
        await repositories.audit.record({
          id: this.#deps.ids.next(),
          occurredAt: now,
          actorType: 'USER',
          actorId: input.userId,
          action: 'SESSION_REVOKED',
          subjectType: 'SESSION',
          subjectId: state.id,
          requestId: input.requestId,
          metadata: { reason: 'PASSWORD_CHANGED' },
        });
      }
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'PASSWORD_CHANGED',
        subjectType: 'USER',
        subjectId: input.userId,
        requestId: input.requestId,
        metadata: { endedSessions: others.length },
      });
    });
  }
}
