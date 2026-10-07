import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { RegisterCustomer } from '../../../src/application/onboarding/register-customer.ts';
import { createAccountsModule } from '../../../src/modules/accounts/index.ts';
import { RegisterUser } from '../../../src/modules/identity/application/register-user.ts';
import { AesGcmCpfProtector } from '../../../src/modules/identity/infrastructure/aes-gcm-cpf-protector.ts';
import { PgIdentityRepositories } from '../../../src/modules/identity/infrastructure/pg-identity-repositories.ts';
import { createLedgerModule } from '../../../src/modules/ledger/index.ts';
import type { Clock } from '../../../src/shared/application/ports.ts';
import { PgUnitOfWork } from '../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../src/shared/infrastructure/system-ports.ts';
import {
  FakeAccessTokens,
  FakeHasher,
  FakeRefreshTokens,
} from '../../modules/identity/application/fakes.ts';

/** The real token hash is unique per token; the database enforces it. */
class FakeRefreshTokensWithUniqueHash extends FakeRefreshTokens {
  override generate() {
    return { token: 'refresh-token-value', hash: randomBytes(32) };
  }
}

/**
 * Registration with the real repositories of every context on Postgres, and
 * fakes only where real ones would be slow or random (hashing, tokens).
 */
export function pgRegisterCustomer(pool: pg.Pool, clock: Clock): RegisterCustomer {
  const ids = new UuidV7Generator();
  const ledger = createLedgerModule({ clock, ids });
  const unitOfWork = new PgUnitOfWork(pool);
  const accounts = createAccountsModule({
    unitOfWork,
    clock,
    ids,
    ledger: ledger.customerAccounts,
  });
  const identity = new RegisterUser({
    repositories: new PgIdentityRepositories(),
    clock,
    ids,
    hasher: new FakeHasher(),
    cpfProtector: new AesGcmCpfProtector({
      keyVersion: 1,
      encryptionKey: randomBytes(32),
      hmacKey: Buffer.alloc(32, 7),
    }),
    commonPasswords: { contains: () => false },
    refreshTokens: new FakeRefreshTokensWithUniqueHash(),
    accessTokens: new FakeAccessTokens(),
  });
  return new RegisterCustomer({
    unitOfWork,
    identity,
    accounts: accounts.openAccount,
    ledger: ledger.customerAccounts,
  });
}
