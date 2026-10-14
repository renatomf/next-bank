import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { PixKey } from '../domain/pix-key.ts';
import type { AccountsPort, PaymentsRepositoriesFactory, PixKeyValueProtector } from './ports.ts';

/** The key as the "Receber" screen needs it: whole for the QR Code, masked for the text. */
export interface ReceivingKey {
  key: string;
  keyMasked: string;
}

export interface GetReceivingKeyDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  accounts: AccountsPort;
  clock: Clock;
  /** Row ids (UUID v7). */
  ids: IdGenerator;
  /** Key values: random UUIDs v4, never the row ids, which carry their creation time. */
  randomKeys: IdGenerator;
}

/**
 * The customer's random key to receive by QR Code, created the first time
 * (v1.1.0 plan, task 3; D2). The QR Code never carries the CPF (PIX-12).
 */
export class GetReceivingKey {
  readonly #deps: GetReceivingKeyDependencies;

  constructor(deps: GetReceivingKeyDependencies) {
    this.#deps = deps;
  }

  async execute(input: { customerId: string }): Promise<ReceivingKey> {
    const { unitOfWork, repositories, protector, accounts, clock, ids, randomKeys } = this.#deps;
    return unitOfWork.run(async (tx) => {
      // The account always comes from the token (PIX-01).
      const account = await accounts.findByHolder(tx, input.customerId);
      if (account === null) throw new Error(`Customer without an account: ${input.customerId}`);

      const candidate = PixKey.random({
        id: ids.next(),
        accountId: account.id,
        value: randomKeys.next(),
        now: clock.now(),
      });
      const { type, value, masked } = candidate.state;
      const keys = repositories.for(tx).pixKeys;
      if (await keys.insertRandomIfAbsent(candidate.state, protector.protect(type, value))) {
        return { key: value, keyMasked: masked };
      }

      // The account already had one, maybe created a moment ago by a concurrent call.
      const stored = await keys.findRandomOf(account.id);
      if (stored === null) throw new Error(`Random Pix key vanished for account ${account.id}`);
      return { key: protector.reveal('RANDOM', stored), keyMasked: stored.masked };
    });
  }
}
