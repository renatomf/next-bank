import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import type { Cpf } from '../../../shared/domain/cpf.ts';
import { PixKey } from '../domain/pix-key.ts';
import type { PaymentsRepositoriesFactory, PixKeyValueProtector } from './ports.ts';

/**
 * Registers the holder's CPF as the Pix key of the new account, in the
 * registration's transaction (domain-model.md 3.4 and 8).
 */
export class CreateCpfKey {
  readonly #repositories: PaymentsRepositoriesFactory;
  readonly #protector: PixKeyValueProtector;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;

  constructor(deps: {
    repositories: PaymentsRepositoriesFactory;
    protector: PixKeyValueProtector;
    clock: Clock;
    ids: IdGenerator;
  }) {
    this.#repositories = deps.repositories;
    this.#protector = deps.protector;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  async execute(tx: Transaction, input: { accountId: string; cpf: Cpf }): Promise<void> {
    const key = PixKey.forHolderCpf({
      id: this.#ids.next(),
      accountId: input.accountId,
      cpf: input.cpf,
      now: this.#clock.now(),
    });
    const { type, value } = key.state;
    await this.#repositories
      .for(tx)
      .pixKeys.insert(key.state, this.#protector.protect(type, value));
  }
}
