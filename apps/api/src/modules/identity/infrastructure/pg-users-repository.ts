import pg from 'pg';
import type { LoginAccount, StoredCpf, UsersRepository } from '../application/ports.ts';
import { AlreadyRegistered } from '../domain/errors.ts';
import type { UserState, UserStatus } from '../domain/user.ts';

const UNIQUE_VIOLATION = '23505';
const IDENTITY_CONSTRAINTS = new Set(['users_email_key', 'users_cpf_hmac_key']);

export class PgUsersRepository implements UsersRepository {
  /** Served by the users_email_key and users_cpf_hmac_key unique indexes. */
  static readonly EXISTS_SQL = `SELECT EXISTS (
      SELECT 1 FROM identity.users WHERE email = $1 OR cpf_hmac = $2
    ) AS exists`;

  /** Served by the users_email_key unique index. */
  static readonly FIND_BY_EMAIL_SQL =
    'SELECT id, password_hash, status FROM identity.users WHERE email = $1';

  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async existsWithEmailOrCpf(email: string, cpfBlindIndex: Uint8Array): Promise<boolean> {
    const { rows } = await this.#client.query<{ exists: boolean }>(PgUsersRepository.EXISTS_SQL, [
      email,
      Buffer.from(cpfBlindIndex),
    ]);
    return rows[0]?.exists ?? false;
  }

  async findByEmail(email: string): Promise<LoginAccount | null> {
    const { rows } = await this.#client.query<{
      id: string;
      password_hash: string;
      status: UserStatus;
    }>(PgUsersRepository.FIND_BY_EMAIL_SQL, [email]);
    const row = rows[0];
    return row ? { id: row.id, passwordHash: row.password_hash, status: row.status } : null;
  }

  async insert(user: UserState, cpf: StoredCpf): Promise<void> {
    try {
      await this.#client.query(
        `INSERT INTO identity.users
           (id, name, cpf_ciphertext, cpf_hmac, cpf_masked, cpf_key_version, email,
            password_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [
          user.id,
          user.name,
          Buffer.from(cpf.ciphertext),
          Buffer.from(cpf.blindIndex),
          cpf.masked,
          cpf.keyVersion,
          user.email,
          user.passwordHash,
          user.status,
          user.createdAt,
        ],
      );
    } catch (error) {
      // Two simultaneous registrations both pass the existence check;
      // the unique constraint decides (T-DB-11).
      if (isUniqueViolationOn(error, IDENTITY_CONSTRAINTS)) throw new AlreadyRegistered();
      throw error;
    }
  }
}

function isUniqueViolationOn(error: unknown, constraints: Set<string>): boolean {
  return (
    error instanceof pg.DatabaseError &&
    error.code === UNIQUE_VIOLATION &&
    error.constraint !== undefined &&
    constraints.has(error.constraint)
  );
}
