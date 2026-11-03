import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { StaffMemberExists } from '../domain/errors.ts';
import type { StaffRole } from '../domain/permissions.ts';
import { assertManagedRole, StaffMember, type StaffMemberState } from '../domain/staff-member.ts';
import type { StaffActor } from './manage-staff.ts';
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
  /**
   * Credentials kept elsewhere, for a member recreated with the same ones,
   * as the demo's admin at every reset (v1.3.0 plan, task 2, D4). Drawn here
   * when absent.
   */
  credentials?: { password: string; totpSecret: string };
  /**
   * The admin who adds the member from the backoffice (task 7), who gives
   * only an operator or an analyst (G1, STF-14); none from the script.
   */
  author?: StaffActor;
}

/** What the new member needs to sign in, shown once and never stored in the clear. */
export interface CreatedStaffMember {
  id: string;
  /** The member as created, for the admin's screen. */
  member: StaffMemberState;
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
 * Adds a member to the staff (v1.3.0 plan, task 1, S7): from the script,
 * or from the admin's screen (task 7). Its password and TOTP secret are
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
    if (input.author) assertManagedRole(input.role);
    const member = StaffMember.create({
      email: input.email,
      name: input.name,
      role: input.role,
      isDemo: input.isDemo,
      id: this.#deps.ids.next(),
      now,
    });
    const password = input.credentials?.password ?? this.#deps.tokens.generate().token;
    const totpSecret = input.credentials?.totpSecret ?? this.#deps.totp.newSecret();
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
      // The script runs with nobody signed in: the system records it.
      const { author } = input;
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: author ? 'STAFF' : 'SYSTEM',
        actorId: author?.memberId ?? null,
        action: 'STAFF_MEMBER_CREATED',
        subjectType: 'STAFF_MEMBER',
        subjectId: member.state.id,
        requestId: author?.requestId ?? null,
        metadata: { role: member.state.role, isDemo: member.state.isDemo },
      });
    });

    return {
      id: member.state.id,
      member: member.state,
      email: member.state.email,
      password,
      totpSecret,
      totpUri: this.#deps.totp.uriFor(totpSecret, member.state.email),
    };
  }
}
