import {
  AesGcmPiiProtector,
  type PiiKeys,
} from '../../../shared/infrastructure/aes-gcm-pii-protector.ts';
import type { CpfProtector, EncryptedCpf } from '../application/ports.ts';
import { Cpf } from '../../../shared/domain/cpf.ts';

/** The user's CPF, with the layout stored since week 3 (database.md, section 2). */
export class AesGcmCpfProtector implements CpfProtector {
  readonly #protector: AesGcmPiiProtector;

  constructor(keys: PiiKeys) {
    this.#protector = new AesGcmPiiProtector(keys, {
      associatedData: 'identity.users.cpf',
      indexPrefix: 'cpf',
    });
  }

  encrypt(cpf: Cpf): EncryptedCpf {
    return this.#protector.encrypt(cpf.digits);
  }

  decrypt(encrypted: EncryptedCpf): Cpf {
    return Cpf.parse(this.#protector.decrypt(encrypted));
  }

  blindIndex(cpf: Cpf): Uint8Array {
    return this.#protector.blindIndex(cpf.digits);
  }
}
