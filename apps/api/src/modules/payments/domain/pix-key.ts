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

// The Bacen's random key (EVP) is a UUID; v4 is the one with no time or
// counter in it, so nothing about the key can be guessed.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function randomValueOf(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return UUID_V4.test(value) ? value : null;
}

/** Only the ends show: enough for the customer to recognize the key. */
function maskRandom(value: string): string {
  return `${value.slice(0, 4)}****-****-****-****-********${value.slice(-4)}`;
}

/**
 * A public identifier that receives Pix for an account (domain-model.md 3.4).
 * Each customer has the holder's CPF, created at registration, so "a CPF key
 * is the holder's CPF" holds by construction; and, since v1.1.0, one random
 * key, the one shared in a QR Code so the CPF never is (PIX-12).
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

  /** The value comes from a source of random UUIDs; anything else is a wiring bug. */
  static random(input: { id: string; accountId: string; value: string; now: Date }): PixKey {
    const value = randomValueOf(input.value);
    if (value === null) throw new Error('Random Pix key must be a UUID v4');
    return new PixKey({
      id: input.id,
      accountId: input.accountId,
      type: 'RANDOM',
      value,
      masked: maskRandom(value),
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
  if (type === 'RANDOM') {
    const value = randomValueOf(raw);
    if (value === null) throw new PixKeyNotFound();
    return value;
  }
  if (type !== 'CPF') throw new PixKeyNotFound();
  try {
    return Cpf.parse(raw).digits;
  } catch {
    // Cpf.parse throws only InvalidCpf.
    throw new PixKeyNotFound();
  }
}
