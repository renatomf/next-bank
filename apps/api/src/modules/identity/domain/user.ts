import type { Cpf } from './cpf.ts';

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
      email: input.email.trim().toLowerCase(),
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
