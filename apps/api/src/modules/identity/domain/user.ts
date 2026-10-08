import type { Cpf } from '../../../shared/domain/cpf.ts';

export type UserStatus = 'ACTIVE' | 'LOCKED';

export interface UserState {
  id: string;
  name: string;
  /** Always trimmed and lowercase, so uniqueness does not depend on how it was typed. */
  email: string;
  cpf: Cpf;
  passwordHash: string;
  status: UserStatus;
  createdAt: Date;
}

/** The single e-mail normalization, shared by registration and login so they never disagree. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A registered customer (domain-model.md 3.1). Format checks happen at the HTTP border. */
export class User {
  readonly #state: UserState;

  private constructor(state: UserState) {
    this.#state = state;
  }

  static register(input: {
    id: string;
    name: string;
    email: string;
    cpf: Cpf;
    passwordHash: string;
    now: Date;
  }): User {
    return new User({
      id: input.id,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      cpf: input.cpf,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      createdAt: input.now,
    });
  }

  get state(): Readonly<UserState> {
    return { ...this.#state };
  }
}
