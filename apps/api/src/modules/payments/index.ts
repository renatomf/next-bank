// Public API of the payments context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator } from '../../shared/application/ports.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { CreateCpfKey } from './application/create-cpf-key.ts';
import { AesGcmPixKeyProtector } from './infrastructure/aes-gcm-pix-key-protector.ts';
import { PgPaymentsRepositories } from './infrastructure/pg-payments-repositories.ts';

export type { CreateCpfKey } from './application/create-cpf-key.ts';

export interface PaymentsModule {
  createCpfKey: CreateCpfKey;
}

/** Builds the payments context with its production adapters. */
export function createPaymentsModule(settings: {
  clock: Clock;
  ids: IdGenerator;
  piiKeys: PiiKeys;
}): PaymentsModule {
  return {
    createCpfKey: new CreateCpfKey({
      repositories: new PgPaymentsRepositories(),
      protector: new AesGcmPixKeyProtector(settings.piiKeys),
      clock: settings.clock,
      ids: settings.ids,
    }),
  };
}
