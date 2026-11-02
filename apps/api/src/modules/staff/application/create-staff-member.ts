import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { StaffMemberExists } from '../domain/errors.ts';
import type { StaffRole } from '../domain/permissions.ts';
import { StaffMember } from '../domain/staff-member.ts';
import type {
  SecretBox,
  SecretHasher,
  SessionTokens,
  StaffRepositoriesFactory,
  TotpVerifier,
} from './ports.ts';

export interface CreateStaffMemberInput {
  email: string;
  name: string;
  role: StaffRole;
  isDemo: boolean;
}

/** What the new member needs to sign in, shown once and never stored in the clear. */
export interface CreatedStaffMember {
  id: string;
  email: string;
  password: string;
  totpSecret: string;
  totpUri: string;
}

export interface CreateStaffMemberDependencies {
  unitOfWork: UnitOfWork;
  repositories: StaffRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  hasher: SecretHasher;
  totp: TotpVerifier;
  secrets: SecretBox;
  /** Draws the password: as random as a session token. */
  tokens: SessionTokens;
}

/**
 * Adds a member to the staff (v1.3.0 plan, task 1, S7): from the script
 * now, from the admin's screen in task 7. Its password and TOTP secret are
 * drawn here and shown once; the database keeps the password's Argon2id hash
 * and the secret sealed with the staff's key (S5).
 */
export class CreateStaffMember {
  readonly #deps: CreateStaffMemberDependencies;

  constructor(deps: CreateStaffMemberDependencies) {
    this.#deps = deps;
  }

  async execute(input: CreateStaffMemberInput): Promise<CreatedStaffMember> {
    const now = this.#deps.clock.now();
    const member = StaffMember.create({ ...input, id: this.#deps.ids.next(), now });
    const password = this.#deps.tokens.generate().token;
    const totpSecret = this.#deps.totp.newSecret();
    const passwordHash = await this.#deps.hasher.hash(password);

    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      if ((await repositories.members.findByEmail(member.state.email)) !== null) {
        throw new StaffMemberExists();
      }
      await repositories.members.insert({
        state: member.state,
        passwordHash,
        totpSecret: this.#deps.secrets.seal(totpSecret),
      });
      // No staff member is signed in to create the first one: the system records it.
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'SYSTEM',
        actorId: null,
        action: 'STAFF_MEMBER_CREATED',
        subjectType: 'STAFF_MEMBER',
        subjectId: member.state.id,
        requestId: null,
        metadata: { role: member.state.role, isDemo: member.state.isDemo },
      });
    });

    return {
      id: member.state.id,
      email: member.state.email,
      password,
      totpSecret,
      totpUri: this.#deps.totp.uriFor(totpSecret, member.state.email),
    };
  }
}
