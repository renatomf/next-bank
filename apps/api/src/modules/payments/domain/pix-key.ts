import { Cpf } from '../../../shared/domain/cpf.ts';
import { PixKeyNotFound } from './errors.ts';

export type PixKeyType = 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface PixKeyState {
  id: string;
  accountId: string;
  type: PixKeyType;
  /** Normalized value; personal sensitive data, encrypted when stored. */
  value: string;
  masked: string;
  createdAt: Date;
}

/**
 * A public identifier that receives Pix for an account (domain-model.md 3.4).
 * In V1 each customer has one: the holder's CPF, created at registration, so
 * "a CPF key is the holder's CPF" holds by construction.
 */
export class PixKey {
  readonly #state: PixKeyState;

  private constructor(state: PixKeyState) {
    this.#state = state;
  }

  static forHolderCpf(input: { id: string; accountId: string; cpf: Cpf; now: Date }): PixKey {
    return new PixKey({
      id: input.id,
      accountId: input.accountId,
      type: 'CPF',
      value: input.cpf.digits,
      masked: input.cpf.masked,
      createdAt: input.now,
    });
  }

  get state(): Readonly<PixKeyState> {
    return { ...this.#state };
  }
}

/**
 * The normalized value to look a key up by. A value that no key can have (an
 * invalid CPF, a type V1 does not register) is simply not found.
 */
export function pixKeyValue(type: PixKeyType, raw: string): string {
  if (type !== 'CPF') throw new PixKeyNotFound();
  try {
    return Cpf.parse(raw).digits;
  } catch {
    // Cpf.parse throws only InvalidCpf.
    throw new PixKeyNotFound();
  }
}
