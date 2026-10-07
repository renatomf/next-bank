import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { Unauthenticated } from '../domain/errors.ts';
import type { IdentityRepositoriesFactory, Profile } from './ports.ts';

/**
 * The caller's own profile. The app uses it to greet the customer and to
 * resume registration when it stopped before the PIN was created.
 */
export class GetProfile {
  readonly #unitOfWork: UnitOfWork;
  readonly #repositories: IdentityRepositoriesFactory;

  constructor(deps: { unitOfWork: UnitOfWork; repositories: IdentityRepositoriesFactory }) {
    this.#unitOfWork = deps.unitOfWork;
    this.#repositories = deps.repositories;
  }

  async execute(userId: string): Promise<Profile> {
    const profile = await this.#unitOfWork.run((tx) =>
      this.#repositories.for(tx).users.findProfile(userId),
    );
    // Users are never deleted, so a valid token always has a user; if not, the
    // token is not trusted rather than revealing anything about the id.
    if (profile === null) throw new Unauthenticated();
    return profile;
  }
}
