import pg from 'pg';
import type {
  Credentials,
  LoginAccount,
  Payee,
  Profile,
  StoredCpf,
  UsersRepository,
} from '../application/ports.ts';
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

  /** Served by the primary keys of users and transaction_pins. */
  static readonly FIND_PROFILE_SQL = `SELECT u.name, u.cpf_masked,
      EXISTS (SELECT 1 FROM identity.transaction_pins p WHERE p.user_id = u.id) AS has_pin
    FROM identity.users u WHERE u.id = $1`;

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

  async findCredentials(id: string): Promise<Credentials | null> {
    const { rows } = await this.#client.query<{
      email: string;
      password_hash: string;
      is_demo: boolean;
    }>('SELECT email, password_hash, is_demo FROM identity.users WHERE id = $1', [id]);
    const row = rows[0];
    return row ? { email: row.email, passwordHash: row.password_hash, isDemo: row.is_demo } : null;
  }

  /** FOR SHARE: blocks a password change until this transaction ends, and waits for one. */
  async lockPasswordHash(id: string): Promise<string | null> {
    const { rows } = await this.#client.query<{ password_hash: string }>(
      'SELECT password_hash FROM identity.users WHERE id = $1 FOR SHARE',
      [id],
    );
    return rows[0]?.password_hash ?? null;
  }

  /** Only the hash: the plain password never reaches the database. */
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.#client.query('UPDATE identity.users SET password_hash = $2 WHERE id = $1', [
      id,
      passwordHash,
    ]);
  }

  async findProfile(id: string): Promise<Profile | null> {
    const { rows } = await this.#client.query<{
      name: string;
      cpf_masked: string;
      has_pin: boolean;
    }>(PgUsersRepository.FIND_PROFILE_SQL, [id]);
    const row = rows[0];
    return row ? { name: row.name, cpfMasked: row.cpf_masked, hasPin: row.has_pin } : null;
  }

  /** Served by the primary key. */
  async findPayee(id: string): Promise<Payee | null> {
    const { rows } = await this.#client.query<{ name: string; cpf_masked: string }>(
      'SELECT name, cpf_masked FROM identity.users WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row ? { name: row.name, documentMasked: row.cpf_masked } : null;
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
