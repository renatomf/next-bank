import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  StaffMemberRecord,
  StaffMembersRepository,
  StaffRepositories,
  StaffRepositoriesFactory,
  StaffSessionsRepository,
} from '../application/ports.ts';
import type { StaffRole } from '../domain/permissions.ts';
import type { StaffMemberState, StaffStatus } from '../domain/staff-member.ts';
import type { StaffSessionState } from '../domain/staff-session.ts';

interface MemberRow {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  /** bigint arrives as a string. */
  last_totp_step: string | null;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}

const MEMBER_COLUMNS = `id, email, name, role, status, last_totp_step, is_demo, created_at, updated_at`;

function toMember(row: MemberRow): StaffMemberState {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    lastTotpStep: row.last_totp_step === null ? null : Number(row.last_totp_step),
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class PgStaffMembersRepository implements StaffMembersRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async findByEmail(email: string): Promise<StaffMemberRecord | null> {
    // Served by members_email_key.
    const { rows } = await this.#client.query<
      MemberRow & {
        password_hash: string;
        totp_secret_ciphertext: Buffer;
        totp_key_version: number;
      }
    >(
      `SELECT ${MEMBER_COLUMNS}, password_hash, totp_secret_ciphertext, totp_key_version
       FROM staff.members WHERE email = $1`,
      [email],
    );
    const row = rows[0];
    return row
      ? {
          state: toMember(row),
          passwordHash: row.password_hash,
          totpSecret: { ciphertext: row.totp_secret_ciphertext, keyVersion: row.totp_key_version },
        }
      : null;
  }

  async lock(id: string): Promise<StaffMemberState | null> {
    // Served by members_pkey; locked until the transaction ends.
    const { rows } = await this.#client.query<MemberRow>(
      `SELECT ${MEMBER_COLUMNS} FROM staff.members WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    return row ? toMember(row) : null;
  }

  /** Served by the primary key. */
  async namesOf(ids: string[]): Promise<Map<string, string>> {
    const { rows } = await this.#client.query<{ id: string; name: string }>(
      'SELECT id, name FROM staff.members WHERE id = ANY($1::uuid[])',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async insert({ state, passwordHash, totpSecret }: StaffMemberRecord): Promise<void> {
    await this.#client.query(
      `INSERT INTO staff.members
         (id, email, name, password_hash, totp_secret_ciphertext, totp_key_version,
          last_totp_step, role, status, is_demo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        state.id,
        state.email,
        state.name,
        passwordHash,
        totpSecret.ciphertext,
        totpSecret.keyVersion,
        state.lastTotpStep,
        state.role,
        state.status,
        state.isDemo,
        state.createdAt,
        state.updatedAt,
      ],
    );
  }

  async update(state: StaffMemberState): Promise<void> {
    await this.#client.query(
      'UPDATE staff.members SET last_totp_step = $2, updated_at = $3 WHERE id = $1',
      [state.id, state.lastTotpStep, state.updatedAt],
    );
  }
}

interface SessionRow {
  id: string;
  member_id: string;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

/** The member's columns read with its session, prefixed so they never clash. */
interface MemberColumnsOfSession {
  m_email: string;
  m_name: string;
  m_role: StaffRole;
  m_status: StaffStatus;
  m_last_totp_step: string | null;
  m_is_demo: boolean;
  m_created_at: Date;
  m_updated_at: Date;
}

const SESSION_COLUMNS = 'id, member_id, created_at, last_seen_at, expires_at, revoked_at';

function toSession(row: SessionRow): StaffSessionState {
  return {
    id: row.id,
    memberId: row.member_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

class PgStaffSessionsRepository implements StaffSessionsRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(state: StaffSessionState, tokenHash: Uint8Array): Promise<void> {
    await this.#client.query(
      `INSERT INTO staff.sessions
         (id, member_id, token_hash, created_at, last_seen_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        state.id,
        state.memberId,
        tokenHash,
        state.createdAt,
        state.lastSeenAt,
        state.expiresAt,
        state.revokedAt,
      ],
    );
  }

  async findByTokenHash(
    tokenHash: Uint8Array,
  ): Promise<{ session: StaffSessionState; member: StaffMemberState } | null> {
    // Served by sessions_token_hash_key and members_pkey.
    const { rows } = await this.#client.query<SessionRow & MemberColumnsOfSession>(
      `SELECT s.id, s.member_id, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at,
              m.email AS m_email, m.name AS m_name, m.role AS m_role, m.status AS m_status,
              m.last_totp_step AS m_last_totp_step, m.is_demo AS m_is_demo,
              m.created_at AS m_created_at, m.updated_at AS m_updated_at
       FROM staff.sessions s JOIN staff.members m ON m.id = s.member_id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return null;
    const member = toMember({
      id: row.member_id,
      email: row.m_email,
      name: row.m_name,
      role: row.m_role,
      status: row.m_status,
      last_totp_step: row.m_last_totp_step,
      is_demo: row.m_is_demo,
      created_at: row.m_created_at,
      updated_at: row.m_updated_at,
    });
    return { session: toSession(row), member };
  }

  async lock(id: string): Promise<StaffSessionState | null> {
    // Served by sessions_pkey; locked until the transaction ends.
    const { rows } = await this.#client.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM staff.sessions WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    return row ? toSession(row) : null;
  }

  /**
   * A revocation is never undone nor moved: a request that read the session
   * before a logout writes back a null revoked_at, which must not win (F-46).
   */
  async update(state: StaffSessionState): Promise<void> {
    await this.#client.query(
      `UPDATE staff.sessions SET last_seen_at = $2, revoked_at = COALESCE(revoked_at, $3)
       WHERE id = $1`,
      [state.id, state.lastSeenAt, state.revokedAt],
    );
  }
}

export class PgStaffRepositories implements StaffRepositoriesFactory {
  for(tx: Transaction): StaffRepositories {
    const client = pgClientOf(tx);
    return {
      members: new PgStaffMembersRepository(client),
      sessions: new PgStaffSessionsRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
